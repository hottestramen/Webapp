import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

// 디자인 토큰 규칙: 컴포넌트에 색상 코드(#...)나 임의 px 값을 직접 쓰지 않는다.
const tokenRules = [
  {
    selector: 'Literal[value=/#[0-9a-fA-F]{3,8}\\b/]',
    message: '색상 코드를 직접 쓰지 마세요. src/styles/tokens.css 의 토큰을 쓰세요.',
  },
  {
    selector: 'TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]',
    message: '색상 코드를 직접 쓰지 마세요. src/styles/tokens.css 의 토큰을 쓰세요.',
  },
  {
    selector: 'Literal[value=/\\dpx\\b/]',
    message: '임의 px 값을 직접 쓰지 마세요. 토큰을 쓰세요.',
  },
  {
    selector: 'TemplateElement[value.raw=/\\dpx\\b/]',
    message: '임의 px 값을 직접 쓰지 마세요. 토큰을 쓰세요.',
  },
  {
    selector: 'JSXAttribute[name.name="dangerouslySetInnerHTML"]',
    message: 'dangerouslySetInnerHTML 은 금지입니다(PRD §5.4).',
  },
  {
    selector: 'Identifier[name="innerHTML"]',
    message: 'innerHTML 은 금지입니다(PRD §5.4).',
  },
];

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'docs'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-restricted-syntax': ['error', ...tokenRules.slice(4)],
    },
  },
  {
    files: ['src/components/**/*.{ts,tsx}', 'src/features/**/*.{ts,tsx}', 'src/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', ...tokenRules],
    },
  },
  {
    // 컴포넌트는 supabase 를 직접 부르지 않고 lib/api 만 쓴다.
    files: [
      'src/components/**/*.{ts,tsx}',
      'src/features/**/*.{ts,tsx}',
      'src/app/**/*.{ts,tsx}',
      'src/stores/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/lib/supabase', '@supabase/*'],
              message: 'supabase 를 직접 호출하지 말고 src/lib/api 의 함수를 쓰세요.',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
