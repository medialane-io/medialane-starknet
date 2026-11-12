import { afterEach } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register({ url: "https://localhost/" });

const { cleanup } = await import("@testing-library/react");
afterEach(() => cleanup());
