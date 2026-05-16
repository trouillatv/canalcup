import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // App française : apostrophes et guillemets dans le JSX sont intentionnels
      "react/no-unescaped-entities": "off",
      // Images <img> acceptées au MVP (pas encore d'upload Supabase Storage)
      "@next/next/no-img-element": "off",
    },
  },
];

export default eslintConfig;
