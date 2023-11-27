import { createGlobalStyle } from 'styled-components'
//[ package ]

import { AnimationCSS } from './animation'
//[ css ]

//=> Style | '全局样式'
export const GlobalStyle = createGlobalStyle`
/* 引入其他 CSS */
${AnimationCSS}
@import 'tailwindcss/base';
@import 'tailwindcss/utilities';
`
