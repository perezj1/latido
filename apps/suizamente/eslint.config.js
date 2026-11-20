const globals = Object.fromEntries(['__SUIZAMENTE_PREVIEW__','window','document','location','history','navigator','URL','URLSearchParams','HTMLElement','FormData','setTimeout','clearTimeout','console','fetch','crypto','self','caches','Response','Request','atob','process','Buffer','globalThis','ResizeObserver'].map(name => [name,'readonly']))
export default [{
  files:['**/*.{js,mjs}'], ignores:['dist/**','node_modules/**'],
  languageOptions:{ ecmaVersion:'latest', sourceType:'module', globals:{...globals,localStorage:'readonly',sessionStorage:'readonly',innerWidth:'readonly',setInterval:'readonly',clearInterval:'readonly',AbortSignal:'readonly'} },
  rules:{ 'no-undef':'error', 'no-unused-vars':['error',{argsIgnorePattern:'^_'}], 'no-dupe-keys':'error', 'no-unreachable':'error', 'valid-typeof':'error' },
}]
