import axios, { AxiosInstance, AxiosResponse } from "axios";

export class AuthController {
    private client: AxiosInstance;
    private token?: string;
    private refreshToken?: string;
    private refreshRequest?: Promise<AxiosResponse<any>>;

    constructor(options: Auth.ControllerOption) {
        this.client = options.client || axios.create();
        this.token = options.token;
        this.refreshToken = options.refreshToken;

        this.initInterceptoprRequest();
        this.initInterceptorResponse();
    }

    initInterceptoprRequest() {
        this.client.interceptors.request.use(
            (config) => {
                if (!this.token) {
                    return config;
                }

                const newConfig = {
                    headers: {},
                    ...config,
                };

                newConfig.headers.Authorization = `Bearer ${this.token}`;
                return newConfig;
            },
            (e) => Promise.reject(e)
        );
    }

    initInterceptorResponse() {
        this.client.interceptors.response.use(
            (res) => res,
            async (error) => {
                if (
                    !this.refreshToken ||
                    error.response.status !== 401 ||
                    error.config.retry
                ) {
                    throw error;
                }

                if (!this.refreshRequest) {
                    this.refreshRequest = this.client.post("/auth/refresh", {
                        refreshToken: this.refreshToken,
                    });
                }

                const { data } = await this.refreshRequest;
                this.token = data.token;
                this.refreshToken = data.refreshToken;

                const newRequest = {
                    ...error.config,
                    retry: true,
                };

                return this.client(newRequest);
            }
        );
    }

    async login({ login, password }: Auth.LoginOption) {
        const { data } = await this.client.post("/auth/login", {
            login,
            password,
        });
        this.token = data.token;
        this.refreshToken = data.refreshToken;
    }

    async logout() {
        this.token = undefined;
        this.refreshToken = undefined;
    }

    async getUsers() {
        const { data } = await this.client("/users");
        return data;
    }
}
