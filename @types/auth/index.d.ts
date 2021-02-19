declare namespace Auth {
    interface ControllerOption {
        client?: import("axios").AxiosInstance;
        token?: string;
        refreshToken?: string;
    }

    interface LoginOption {
        login: string;
        password: string;
    }
}
