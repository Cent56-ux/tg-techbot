"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sb = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const config_1 = require("../config");
if (!config_1.CFG.supabaseUrl || !config_1.CFG.supabaseServiceRole) {
    console.warn('Supabase env not set yet; client will be null until you add env vars.');
}
exports.sb = (config_1.CFG.supabaseUrl && config_1.CFG.supabaseServiceRole)
    ? (0, supabase_js_1.createClient)(config_1.CFG.supabaseUrl, config_1.CFG.supabaseServiceRole, { auth: { persistSession: false } })
    : null;
