/** Google Identity Services (GIS) 型定義 */
declare namespace google.accounts.oauth2 {
  interface TokenResponse {
    access_token: string;
    error?: string;
    expires_in: number;
    scope: string;
    token_type: string;
  }

  interface TokenClientConfig {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
  }

  interface TokenClient {
    requestAccessToken: () => void;
  }

  function initTokenClient(config: TokenClientConfig): TokenClient;
}
