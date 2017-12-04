import { BaseLoginProvider } from '../entities/base-login-provider';
import { SocialUser, LoginProviderClass, LinkedInResponse } from '../entities/user';

declare let IN: any;

export class LinkedinLoginProvider extends BaseLoginProvider {

  public static readonly PROVIDER_ID = 'LINKEDIN';
  public loginProviderObj: LoginProviderClass = new LoginProviderClass();
  childWindow;
  windows = [];

  constructor(private clientId: string) {
    super();
    this.loginProviderObj.id = clientId;
    this.loginProviderObj.name = 'LINKEDIN';
    this.loginProviderObj.url = 'https://platform.linkedin.com/in.js';
  }

  initialize(): Promise<SocialUser> {
    return new Promise((resolve, reject) => {
      this.loadScript(this.loginProviderObj, () => {
          IN.init({
            api_key: this.clientId,
            authorize: true,
            onLoad: this.onLinkedInLoad()
          });

          IN.Event.on(IN, 'auth', () => {
            if (IN.User.isAuthorized()) {
              IN.API.Raw(
                '/people/~:(id,first-name,last-name,email-address,picture-url)'
              ).result( (res: LinkedInResponse) => {
                resolve(this.drawUser(res));
              });
            }
          });

        });
    });
  }

  onLinkedInLoad() {
    IN.Event.on(IN, 'systemReady', () => {
      IN.User.refresh();
    });
  }

  drawUser(response: LinkedInResponse): SocialUser {
    let user: SocialUser = new SocialUser();
    user.id = response.emailAddress;
    user.name = response.firstName + ' ' + response.lastName;
    user.email = response.emailAddress;
    user.photoUrl = response.pictureUrl;
    user.token = IN.ENV.auth.oauth_token;
    user.code = response.code;
    return user;
  }

  signIn(): Promise<any> {
    return new Promise((resolve, reject) => {
      let code = undefined;
      IN.User.authorize( () => {
        this.openPopup().then(resp => {
          IN.API.Raw('/people/~:(id,first-name,last-name,email-address,picture-url)').result( (res) => {
            res.code = resp.code;
            resolve(this.drawUser(res));
          });
        });
      });
    });
  }

  openPopup(): Promise<any> {
    return new Promise((resolve, reject) => {
      let newWindow;
      var end_point = 'https://www.linkedin.com/uas/oauth2/authorization';
      var client_id = this.loginProviderObj.id;
      var redirect_uri = window.location.origin;
      var url = end_point + '?response_type=code&client_id=' + client_id + '&redirect_uri=' + redirect_uri + '&state=STATE';

      newWindow = window.open(url, "_blank", "width=550, height=500, top=50%, left=50%");
      this.windows.push(newWindow);
      this.triggerTimeout(newWindow);

      this.polling(redirect_uri, newWindow).then(function(res) {
        newWindow.close();
        resolve(res);
      });
    });
  }

  triggerTimeout(win) {
    setTimeout(function() { this.childWindow = win }, 100);
  }

  polling(redirectUri: string, popupWindow): Promise<any> {
    return new Promise((resolve, reject) => {
      function parseQueryString(str) {
        var obj = {};
        var key;
        var value;
        str.split('&').forEach(function(keyValue) {
          if (!!keyValue) {
            let values = keyValue.split('=');
            key = values[0], value = values[1];
            let tmp = {};
            tmp[key] = value;
            obj = Object.assign(obj, tmp);
          }
        });

        return obj;
      }

      var interval = setInterval(function() {
        try {
          var popupWindowPath = popupWindow.location;
          if (popupWindowPath.origin === redirectUri) {
            let searchStr = popupWindowPath.search.substring(1).replace(/\/$/, '');
            let obj = parseQueryString(searchStr);
            clearInterval(interval);
            resolve(obj);
          }
        } catch (err) {
        }
      }, 500);
    })
  }

  signOut(): Promise<any> {
    return new Promise((resolve, reject) => {
      IN.User.logout((response: any) => {
        resolve();
      }, (err: any) => {
        reject(err);
      });
    });
  }
}
