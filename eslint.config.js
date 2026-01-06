import js from "@eslint/js";
import tselint from "typescript-eslint";
import prettier from "eslint-config-prettier";

const eslintConfig = [
    js.configs.recommended,
    ...tselint.configs.recommended,
    prettier,
    {
        ignores: ["dist/**", "node_modules/**"],
    },
];

export default eslintConfig;