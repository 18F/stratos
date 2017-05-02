package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	log "github.com/Sirupsen/logrus"

	"github.com/labstack/echo"
	"github.com/labstack/echo/engine/standard"

	"github.com/hpcloud/portal-proxy/repository/cnsis"
	"github.com/hpcloud/portal-proxy/repository/tokens"
)

// UAAResponse - Response returned by Cloud Foundry UAA Service
type UAAResponse struct {
	AccessToken  string `json:"access_token"`
	TokenType    string `json:"token_type"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	Scope        string `json:"scope"`
	JTI          string `json:"jti"`
}

// LoginRes - Response the proxy returns to the caller
type LoginRes struct {
	Account     string   `json:"account"`
	TokenExpiry int64    `json:"token_expiry"`
	APIEndpoint *url.URL `json:"api_endpoint"`
	Admin       bool     `json:"admin"`
}

// VerifySessionRes - Response to the caller from a Verify Session action
type VerifySessionRes struct {
	Account string `json:"account"`
	Admin   bool   `json:"admin"`
}

// ConnectedUser - details about the user connected to a specific service or UAA
type ConnectedUser struct {
	GUID  string `json:"guid"`
	Name  string `json:"name"`
	Admin bool   `json:"admin"`
}

// LoginHookFunc - function that can be hooked into a successful user login
type LoginHookFunc func(c echo.Context) error

// UAAAdminIdentifier - The identifier that the Cloud Foundry UAA Service uses to convey administrative level perms
const UAAAdminIdentifier = "hcp.admin"

// HCFAdminIdentifier - The identifier that the Cloud Foundry HCF Service uses to convey administrative level perms
const HCFAdminIdentifier = "cloud_controller.admin"

// SessionExpiresOnHeader Custom header for communicating the session expiry time to clients
const SessionExpiresOnHeader = "X-Cnap-Session-Expires-On"

// EmptyCookieMatcher - Used to detect and remove empty Cookies sent by certain browsers
var EmptyCookieMatcher *regexp.Regexp = regexp.MustCompile(portalSessionName + "=(?:;[ ]*|$)")

func (p *portalProxy) getHCPIdentityEndpoint() string {
	return fmt.Sprintf("%s/oauth/token", p.Config.UAAEndpoint)
}

func (p *portalProxy) removeEmptyCookie(c echo.Context) {
	req := c.Request().(*standard.Request).Request
	originalCookie := req.Header.Get("Cookie")
	cleanCookie := EmptyCookieMatcher.ReplaceAllLiteralString(originalCookie, "")
	req.Header.Set("Cookie", cleanCookie)
}

func (p *portalProxy) loginToUAA(c echo.Context) error {
	log.Debug("loginToUAA")

	uaaRes, u, err := p.login(c, p.Config.SkipTLSVerification, p.Config.ConsoleClient, p.Config.ConsoleClientSecret, p.getHCPIdentityEndpoint())
	if err != nil {
		err = newHTTPShadowError(
			http.StatusUnauthorized,
			"Access Denied",
			"Access Denied: %v", err)
		return err
	}

	sessionValues := make(map[string]interface{})
	sessionValues["user_id"] = u.UserGUID
	sessionValues["exp"] = u.TokenExpiry

	// Ensure that login disregards cookies from the request
	req := c.Request().(*standard.Request).Request
	req.Header.Set("Cookie", "")
	if err = p.setSessionValues(c, sessionValues); err != nil {
		return err
	}

	// Explicitly tell the client when this session will expire. This is needed because browsers actively hide
	// the Set-Cookie header and session cookie expires_on from client side javascript
	expOn, err := p.getSessionValue(c, "expires_on")
	if err != nil {
		msg := "Could not get session expiry"
		log.Error(msg+" - ", err)
		return echo.NewHTTPError(http.StatusInternalServerError, msg)
	}
	c.Response().Header().Set(SessionExpiresOnHeader, strconv.FormatInt(expOn.(time.Time).Unix(), 10))

	err = p.saveUAAToken(*u, uaaRes.AccessToken, uaaRes.RefreshToken)
	if err != nil {
		return err
	}

	if p.LoginHook != nil {
		err = p.LoginHook(c)
		if err != nil {
			log.Warn("Login hook failed", err)
		}
	}

	uaaAdmin := strings.Contains(uaaRes.Scope, p.UAAAdminIdentifier)

	resp := &LoginRes{
		Account:     c.FormValue("username"),
		TokenExpiry: u.TokenExpiry,
		APIEndpoint: nil,
		Admin:       uaaAdmin,
	}
	jsonString, err := json.Marshal(resp)
	if err != nil {
		return err
	}

	c.Response().Header().Set("Content-Type", "application/json")
	c.Response().Write(jsonString)

	return nil
}

func (p *portalProxy) loginToCNSI(c echo.Context) error {
	log.Debug("loginToCNSI")
	cnsiGUID := c.FormValue("cnsi_guid")

	resp, err := p.doLoginToCNSI(c, cnsiGUID)
	if err != nil {
		return err
	}

	jsonString, err := json.Marshal(resp)
	if err != nil {
		return err
	}

	c.Response().Header().Set("Content-Type", "application/json")
	c.Response().Write(jsonString)
	return nil
}

func (p *portalProxy) doLoginToCNSI(c echo.Context, cnsiGUID string) (*LoginRes, error) {
	uaaRes, u, cnsiRecord, err := p.fetchToken(cnsiGUID, c)

	if err != nil {
		return nil, err
	}

	// save the CNSI token against the Console user guid, not the CNSI user guid so that we can look it up easily
	userID, err := p.getSessionStringValue(c, "user_id")
	if err != nil {
		return nil, echo.NewHTTPError(http.StatusUnauthorized, "Could not find correct session value")
	}
	u.UserGUID = userID

	p.saveCNSIToken(cnsiGUID, *u, uaaRes.AccessToken, uaaRes.RefreshToken)

	if cnsiRecord.CNSIType == cnsis.CNSIHCE {
		// Get the list VCS clients supported by this Code Engine instance
		log.Debug("loginToCNSI (Code Engine), getting list of VCS...")
		err := p.autoRegisterCodeEngineVcs(userID, cnsiGUID)
		if err != nil {
			log.Warnf("loginToCNSI Failed to auto register Code Engine VCS! %#v", err)
		}
	}

	hcfAdmin := strings.Contains(uaaRes.Scope, p.HCFAdminIdentifier)

	resp := &LoginRes{
		Account:     u.UserGUID,
		TokenExpiry: u.TokenExpiry,
		APIEndpoint: cnsiRecord.APIEndpoint,
		Admin:       hcfAdmin,
	}

	return resp, nil
}

func (p *portalProxy) verifyLoginToCNSI(c echo.Context) error {

	log.Debug("verifyLoginToCNSI")

	cnsiGUID := c.FormValue("cnsi_guid")
	_, _, _, err := p.fetchToken(cnsiGUID, c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid credentials")
	}
	return c.NoContent(http.StatusOK)
}

func (p *portalProxy) fetchToken(cnsiGUID string, c echo.Context) (*UAAResponse, *userTokenInfo, *cnsis.CNSIRecord, error) {

	if len(cnsiGUID) == 0 {
		return nil, nil, nil, newHTTPShadowError(
			http.StatusBadRequest,
			"Missing target endpoint",
			"Need CNSI GUID passed as form param")
	}

	endpoint := ""
	cnsiRecord, err := p.getCNSIRecord(cnsiGUID)

	if err != nil {
		return nil, nil, nil, newHTTPShadowError(
			http.StatusBadRequest,
			"Requested endpoint not registered",
			"No CNSI registered with GUID %s: %s", cnsiGUID, err)
	}

	endpoint = cnsiRecord.AuthorizationEndpoint

	tokenEndpoint := fmt.Sprintf("%s/oauth/token", endpoint)

	clientID := p.Config.HCFClient

	if cnsiRecord.CNSIType == cnsis.CNSIHCE {
		clientID = p.Config.HCEClient
	}

	if cnsiRecord.CNSIType == cnsis.CNSIHSM {
		clientID = p.Config.HSMClient
	}

	uaaRes, u, err := p.login(c, cnsiRecord.SkipSSLValidation, clientID, "", tokenEndpoint)

	if err != nil {
		return nil, nil, nil, newHTTPShadowError(
			http.StatusUnauthorized,
			"Login failed",
			"Login failed: %v", err)
	}
	return uaaRes, u, &cnsiRecord, nil

}

func (p *portalProxy) logoutOfCNSI(c echo.Context) error {
	log.Debug("logoutOfCNSI")

	cnsiGUID := c.FormValue("cnsi_guid")

	if len(cnsiGUID) == 0 {
		return newHTTPShadowError(
			http.StatusBadRequest,
			"Missing target endpoint",
			"Need CNSI GUID passed as form param")
	}

	userID, err := p.getSessionStringValue(c, "user_id")
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Could not find correct session value")
	}

	p.deleteCNSIToken(cnsiGUID, userID)

	return nil
}

func (p *portalProxy) login(c echo.Context, skipSSLValidation bool, client string, clientSecret string, endpoint string) (uaaRes *UAAResponse, u *userTokenInfo, err error) {
	log.Debug("login")
	username := c.FormValue("username")
	password := c.FormValue("password")

	if len(username) == 0 || len(password) == 0 {
		return uaaRes, u, errors.New("Needs username and password")
	}

	uaaRes, err = p.getUAATokenWithCreds(skipSSLValidation, username, password, client, clientSecret, endpoint)
	if err != nil {
		return uaaRes, u, err
	}

	u, err = getUserTokenInfo(uaaRes.AccessToken)
	if err != nil {
		return uaaRes, u, err
	}

	return uaaRes, u, nil
}

func (p *portalProxy) logout(c echo.Context) error {
	log.Debug("logout")

	p.removeEmptyCookie(c)

	err := p.clearSession(c)
	if err != nil {
		log.Errorf("Unable to clear session: %v", err)
	}

	return err
}

func (p *portalProxy) getUAATokenWithCreds(skipSSLValidation bool, username, password, client, clientSecret, authEndpoint string) (*UAAResponse, error) {
	log.Debug("getUAATokenWithCreds")
	body := url.Values{}
	body.Set("grant_type", "password")
	body.Set("username", username)
	body.Set("password", password)
	body.Set("response_type", "token")

	return p.getUAAToken(body, skipSSLValidation, client, clientSecret, authEndpoint)
}

func (p *portalProxy) getUAATokenWithRefreshToken(skipSSLValidation bool, refreshToken, client, clientSecret, authEndpoint string) (*UAAResponse, error) {
	log.Debug("getUAATokenWithRefreshToken")
	body := url.Values{}
	body.Set("grant_type", "refresh_token")
	body.Set("refresh_token", refreshToken)
	body.Set("response_type", "token")

	return p.getUAAToken(body, skipSSLValidation, client, clientSecret, authEndpoint)
}

func (p *portalProxy) getUAAToken(body url.Values, skipSSLValidation bool, client, clientSecret, authEndpoint string) (*UAAResponse, error) {
	log.WithField("authEndpoint", authEndpoint).Debug("getUAAToken")
	req, err := http.NewRequest("POST", authEndpoint, strings.NewReader(body.Encode()))
	if err != nil {
		msg := "Failed to create request for UAA: %v"
		log.Errorf(msg, err)
		return nil, fmt.Errorf(msg, err)
	}

	req.SetBasicAuth(client, clientSecret)
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationForm)

	var h http.Client
	if skipSSLValidation {
		h = httpClientSkipSSL
	} else {
		h = httpClient
	}

	res, err := h.Do(req)
	if err != nil || res.StatusCode != http.StatusOK {
		log.Errorf("Error performing http request - response: %v, error: %v", res, err)
		return nil, logHTTPError(res, err)
	}

	defer res.Body.Close()

	var response UAAResponse
	dec := json.NewDecoder(res.Body)
	if err = dec.Decode(&response); err != nil {
		log.Errorf("Error decoding response: %v", err)
		return nil, fmt.Errorf("getUAAToken Decode: %s", err)
	}

	return &response, nil
}

func (p *portalProxy) saveUAAToken(u userTokenInfo, authTok string, refreshTok string) error {
	log.Debug("saveUAAToken")
	key := u.UserGUID
	tokenRecord := tokens.TokenRecord{
		AuthToken:    authTok,
		RefreshToken: refreshTok,
		TokenExpiry:  u.TokenExpiry,
	}

	err := p.setUAATokenRecord(key, tokenRecord)
	if err != nil {
		return err
	}

	return nil
}

func (p *portalProxy) saveCNSIToken(cnsiID string, u userTokenInfo, authTok string, refreshTok string) (tokens.TokenRecord, error) {
	log.Debug("saveCNSIToken")
	tokenRecord := tokens.TokenRecord{
		AuthToken:    authTok,
		RefreshToken: refreshTok,
		TokenExpiry:  u.TokenExpiry,
	}

	err := p.setCNSITokenRecord(cnsiID, u.UserGUID, tokenRecord)
	if err != nil {
		log.Errorf("%v", err)
		return tokens.TokenRecord{}, err
	}

	return tokenRecord, nil
}

func (p *portalProxy) deleteCNSIToken(cnsiID string, userGUID string) error {
	log.Debug("deleteCNSIToken")
	err := p.unsetCNSITokenRecord(cnsiID, userGUID)
	if err != nil {
		log.Errorf("%v", err)
		return err
	}

	return nil
}

func (p *portalProxy) getUAATokenRecord(userGUID string) (tokens.TokenRecord, error) {
	log.Debug("getUAATokenRecord")
	tokenRepo, err := tokens.NewPgsqlTokenRepository(p.DatabaseConnectionPool)
	if err != nil {
		log.Errorf("Database error getting repo for UAA token: %v", err)
		return tokens.TokenRecord{}, err
	}

	tr, err := tokenRepo.FindUAAToken(userGUID, p.Config.EncryptionKeyInBytes)
	if err != nil {
		log.Errorf("Database error finding UAA token: %v", err)
		return tokens.TokenRecord{}, err
	}

	return tr, nil
}

func (p *portalProxy) setUAATokenRecord(key string, t tokens.TokenRecord) error {
	log.Debug("setUAATokenRecord")
	tokenRepo, err := tokens.NewPgsqlTokenRepository(p.DatabaseConnectionPool)
	if err != nil {
		return fmt.Errorf("Database error getting repo for UAA token: %v", err)
	}

	err = tokenRepo.SaveUAAToken(key, t, p.Config.EncryptionKeyInBytes)
	if err != nil {
		return fmt.Errorf("Database error saving UAA token: %v", err)
	}

	return nil
}

func (p *portalProxy) verifySession(c echo.Context) error {
	log.Debug("verifySession")
	sessionExpireTime, err := p.getSessionInt64Value(c, "exp")
	if err != nil {
		msg := "Could not find session date"
		log.Error(msg)
		return echo.NewHTTPError(http.StatusForbidden, msg)
	}

	sessionUser, err := p.getSessionStringValue(c, "user_id")
	if err != nil {
		msg := "Could not find user_id in Session"
		log.Error(msg)
		return echo.NewHTTPError(http.StatusForbidden, msg)
	}

	tr, err := p.getUAATokenRecord(sessionUser)
	if err != nil {
		msg := fmt.Sprintf("Unable to find UAA Token: %s", err)
		log.Error(msg, err)
		return echo.NewHTTPError(http.StatusForbidden, msg)
	}

	// get the scope out of the JWT token data
	userTokenInfo, err := getUserTokenInfo(tr.AuthToken)
	if err != nil {
		msg := fmt.Sprintf("Unable to find scope information in the UAA Auth Token: %s", err)
		log.Error(msg, err)
		return echo.NewHTTPError(http.StatusForbidden, msg)
	}

	// Check if UAA token has expired
	if time.Now().After(time.Unix(sessionExpireTime, 0)) {

		// UAA Token has expired, refresh the token, if that fails, fail the request
		uaaRes, tokenErr := p.getUAATokenWithRefreshToken(p.Config.SkipTLSVerification, tr.RefreshToken, p.Config.ConsoleClient, p.Config.ConsoleClientSecret, p.getHCPIdentityEndpoint())
		if tokenErr != nil {
			msg := "Could not refresh UAA token"
			log.Error(msg, tokenErr)
			return echo.NewHTTPError(http.StatusForbidden, msg)
		}

		u, userTokenErr := getUserTokenInfo(uaaRes.AccessToken)
		if userTokenErr != nil {
			return userTokenErr
		}

		if err = p.saveUAAToken(*u, uaaRes.AccessToken, uaaRes.RefreshToken); err != nil {
			return err
		}
		sessionValues := make(map[string]interface{})
		sessionValues["user_id"] = u.UserGUID
		sessionValues["exp"] = u.TokenExpiry

		if err = p.setSessionValues(c, sessionValues); err != nil {
			return err
		}
		userTokenInfo = u
	} else {
		// Still need to extend the expires_on of the Session
		if err = p.setSessionValues(c, nil); err != nil {
			return err
		}
	}

	// Explicitly tell the client when this session will expire. This is needed because browsers actively hide
	// the Set-Cookie header and session cookie expires_on from client side javascript
	expOn, err := p.getSessionValue(c, "expires_on")
	if err != nil {
		msg := "Could not get session expiry"
		log.Error(msg+" - ", err)
		return echo.NewHTTPError(http.StatusInternalServerError, msg)
	}
	c.Response().Header().Set(SessionExpiresOnHeader, strconv.FormatInt(expOn.(time.Time).Unix(), 10))

	uaaAdmin := strings.Contains(strings.Join(userTokenInfo.Scope, ""), p.UAAAdminIdentifier)

	resp := &VerifySessionRes{
		Account: sessionUser,
		Admin:   uaaAdmin,
	}

	err = c.JSON(http.StatusOK, resp)
	if err != nil {
		return err
	}

	return nil
}

func (p *portalProxy) getUAAUser(userGUID string) (*ConnectedUser, error) {
	log.Debug("getUAAUser")
	// get the uaa token record
	uaaTokenRecord, err := p.getUAATokenRecord(userGUID)
	if err != nil {
		msg := "Unable to retrieve UAA token record."
		log.Error(msg)
		return nil, fmt.Errorf(msg)
	}

	// get the scope out of the JWT token data
	userTokenInfo, err := getUserTokenInfo(uaaTokenRecord.AuthToken)
	if err != nil {
		msg := "Unable to find scope information in the UAA Auth Token: %s"
		log.Errorf(msg, err)
		return nil, fmt.Errorf(msg, err)
	}

	// is the user a UAA admin?
	uaaAdmin := strings.Contains(strings.Join(userTokenInfo.Scope, ""), p.UAAAdminIdentifier)

	// add the uaa entry to the output
	uaaEntry := &ConnectedUser{
		GUID:  userGUID,
		Name:  userTokenInfo.UserName,
		Admin: uaaAdmin,
	}

	return uaaEntry, nil
}

func (p *portalProxy) getCNSIUser(cnsiGUID string, userGUID string) (*ConnectedUser, bool) {
	log.Debug("getCNSIUser")
	// get the uaa token record
	hcfTokenRecord, ok := p.getCNSITokenRecord(cnsiGUID, userGUID)
	if !ok {
		msg := "Unable to retrieve CNSI token record."
		log.Error(msg)
		return nil, false
	}

	// get the scope out of the JWT token data
	userTokenInfo, err := getUserTokenInfo(hcfTokenRecord.AuthToken)
	if err != nil {
		msg := "Unable to find scope information in the UAA Auth Token: %s"
		log.Errorf(msg, err)
		return nil, false
	}

	// add the uaa entry to the output
	cnsiUser := &ConnectedUser{
		GUID: userTokenInfo.UserGUID,
		Name: userTokenInfo.UserName,
	}

	// is the user an HCF admin?
	cnsiRecord, err := p.getCNSIRecord(cnsiGUID)
	if err != nil {
		msg := "Unable to load CNSI record: %s"
		log.Errorf(msg, err)
		return nil, false
	}
	if cnsiRecord.CNSIType == cnsis.CNSIHCF {
		cnsiAdmin := strings.Contains(strings.Join(userTokenInfo.Scope, ""), p.HCFAdminIdentifier)
		cnsiUser.Admin = cnsiAdmin
	}

	return cnsiUser, true
}
