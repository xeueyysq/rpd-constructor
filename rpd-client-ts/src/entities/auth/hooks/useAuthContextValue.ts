import {useCallback, useEffect, useState} from "react"
import {useAuth} from "./useAuth.ts"
import inMemoryJWT from "../lib/inMemoryJWT.ts"
import config from "@shared/config"
import {AuthClient} from "../api/clients.ts"
import {AuthContextProps, UserCredentials} from "../model/types.ts"
import {showErrorMessage} from "@shared/lib"

export const useAuthContextValue = (): AuthContextProps => {
    const [isAppReady, setIsAppReady] = useState(false)
    const [isUserLogged, setIsUserLogged] = useState(false)
    const [data, setData] = useState<UserCredentials>()
    const {updateAbility, updateUserName} = useAuth()

    const handleLogOut = () => {
        AuthClient.post("/logout")
            .then(() => {
                setIsUserLogged(false)
                inMemoryJWT.deleteToken()
                updateAbility()
                updateUserName(undefined)
                setData(undefined)
            })
            .catch((error) => showErrorMessage(error.response.data.error))
    }

    const handleSignIn = (data: UserCredentials) => {
        AuthClient.post("/sign-in", data)
            .then((res) => {
                const {fullname, role, accessToken, accessTokenExpiration} = res.data

                inMemoryJWT.setToken(accessToken, accessTokenExpiration)
                updateAbility(role)
                updateUserName(fullname)
                setIsUserLogged(true)
            })
            .catch((error) => showErrorMessage(error.response.data.error))
    }

    const refreshToken = useCallback(() => {
        AuthClient.post("/refresh")
            .then((res) => {
                const {role, fullname, accessToken, accessTokenExpiration} = res.data
                inMemoryJWT.setToken(accessToken, accessTokenExpiration)
                updateAbility(role)
                updateUserName(fullname)

                setIsAppReady(true)
                setIsUserLogged(true)
            })
            .catch(() => {
                setIsAppReady(true)
                setIsUserLogged(false)
            })
    }, [updateAbility, updateUserName])

    useEffect(() => {
        refreshToken()
    }, [refreshToken])

    useEffect(() => {
        const handlePersistedLogOut = (event: StorageEvent) => {
            if (event.key === config.LOGOUT_STORAGE_KEY) {
                inMemoryJWT.deleteToken()
                setIsUserLogged(false)
            }
        }

        window.addEventListener("storage", handlePersistedLogOut)

        return () => {
            window.removeEventListener("storage", handlePersistedLogOut)
        }
    }, [])

    return {
        isAppReady,
        isUserLogged,
        data,
        handleLogOut,
        handleSignIn
    }
}