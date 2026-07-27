import { desktopAssets, startDesktopBackend } from "./backend.ts";
import { startHttpServer } from "./http.ts";

startDesktopBackend();
startHttpServer(desktopAssets);
