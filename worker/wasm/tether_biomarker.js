/* @ts-self-types="./tether_biomarker.d.ts" */

import * as wasm from "./tether_biomarker_bg.wasm";
import { __wbg_set_wasm } from "./tether_biomarker_bg.js";
__wbg_set_wasm(wasm);
wasm.__wbindgen_start();
export {
    analyze_audio
} from "./tether_biomarker_bg.js";
