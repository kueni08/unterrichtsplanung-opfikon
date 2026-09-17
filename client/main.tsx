import React from "react";
import { createRoot } from "react-dom/client";
import Home from "../app/page";
import { AccountGate } from "./account";
import { PwaPanel } from "./pwa";
import "../app/globals.css";
createRoot(document.getElementById("root")!).render(<AccountGate>{user => <><Home key={user.id} user={user}/><PwaPanel /></>}</AccountGate>);
