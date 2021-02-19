import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { AuthController } from "../src/features/auth";

const prepare = () => {
    const client = axios.create();
    const mock = new MockAdapter(client);
    const api = new AuthController({ client });

    return { mock, api };
};

const LOGIN_REQUEST = {
    login: "USER_1",
    password: "USER_1",
};

const LOGIN_RESPONSE = {
    token: "TOKEN",
    refreshToken: "REFRESH_TOKEN",
};

const REFRESH_REQUEST = {
    refreshToken: LOGIN_RESPONSE.refreshToken,
};

const REFRESH_RESPONSE = {
    token: "TOKEN_2",
    refreshToken: "REFRESH_TOKEN_2",
};

describe("Auth", () => {
    test("Login captures token information", async () => {
        const { mock, api } = prepare();

        mock.onPost("/auth/login", LOGIN_REQUEST).reply(200, LOGIN_RESPONSE);
        mock.onGet("/users").reply(200, []);

        await api.login(LOGIN_REQUEST);
        await api.getUsers();

        expect(mock.history.get.length).toBe(1);
        expect(mock.history.get[0].headers.Authorization).toBe(
            `Bearer ${LOGIN_RESPONSE.token}`
        );
    });

    test("Logout removes token information", async () => {
        const { mock, api } = prepare();

        mock.onPost("/auth/login", LOGIN_REQUEST).reply(200, LOGIN_RESPONSE);
        mock.onGet("/users").reply(200, []);

        await api.login(LOGIN_REQUEST);
        await api.logout();
        await api.getUsers();

        expect(mock.history.get.length).toBe(1);
        expect(mock.history.get[0].headers.Authorization).toBeFalsy();
    });

    test("Correctly retries request when got 401 with new token", async () => {
        const { mock, api } = prepare();

        mock.onPost("/auth/login", LOGIN_REQUEST).reply(200, LOGIN_RESPONSE);
        mock.onPost("/auth/refresh", REFRESH_REQUEST).replyOnce(
            200,
            REFRESH_RESPONSE
        );
        mock.onGet("/users").reply((config) => {
            const { Authorization: auth } = config.headers;
            if (auth === `Bearer ${LOGIN_RESPONSE.token}`) {
                return [401];
            }
            if (auth === `Bearer ${REFRESH_RESPONSE.token}`) {
                return [200, []];
            }
            return [404];
        });

        await api.login(LOGIN_REQUEST);
        await api.getUsers();

        expect(mock.history.get.length).toBe(2);
        expect(mock.history.get[1].headers.Authorization).toBe(
            `Bearer ${REFRESH_RESPONSE.token}`
        );
    });

    test("Correctly fails request when got non-401 error", async () => {
        const { mock, api } = prepare();

        mock.onGet("/users").reply(404);

        expect(() => api.getUsers()).rejects.toThrow();
    });

    test("Does not consumes token more than once", async () => {
        const { mock, api } = prepare();

        mock.onPost("/auth/login", LOGIN_REQUEST).reply(200, LOGIN_RESPONSE);
        mock.onPost("/auth/refresh", REFRESH_REQUEST).replyOnce(
            200,
            REFRESH_RESPONSE
        );

        mock.onGet("/users").reply((config) => {
            const { Authorization: auth } = config.headers;
            if (auth === `Bearer ${LOGIN_RESPONSE.token}`) {
                return [401];
            }
            if (auth === `Bearer ${REFRESH_RESPONSE.token}`) {
                return [200, []];
            }
            return [404];
        });

        await api.login(LOGIN_REQUEST);
        await Promise.all([api.getUsers(), api.getUsers()]);

        expect(
            mock.history.post.filter(({ url }) => url === "/auth/refresh")
                .length
        ).toBe(1);
    });
});
