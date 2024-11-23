import React from "react";
import ReactDOM from "react-dom/client";
import {AppProviders} from "./providers";
import './styles/global.css'
import {AppRouter} from "./routers";

const root = ReactDOM.createRoot(document.getElementById("root")!);

root.render(
    <React.StrictMode>
        <AppProviders>
            <AppRouter/>
        </AppProviders>
    </React.StrictMode>
);
