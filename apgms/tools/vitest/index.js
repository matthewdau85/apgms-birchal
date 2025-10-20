import { describe as runtimeDescribe, expect as runtimeExpect, it as runtimeIt } from "./runtime.js";

export const describe = runtimeDescribe;
export const it = runtimeIt;
export const test = runtimeIt;
export const expect = runtimeExpect;
