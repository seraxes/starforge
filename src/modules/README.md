# Extension modules (particles)

Product features that hang off Starforge core (not Payload plugins).

| Particle | Id | Notes |
| --- | --- | --- |
| Notice bar | `notice-bar` | Extension — needs Modules toggle |
| Form | `form` | Core Form — fields JSON, submissions in Admin → Forms; needs `product:forms` |
| Page Content | `page-content` | Built-in (core) |
| Site Header | `site-header` | Built-in (core) |
| Logo / Image | `logo` | Built-in — image (Media/URL) or **text logo** (font/size/weight/color) |
| Menu | `menu` | Built-in — Nav manager menu set (default = site primary) |
| Copyright | `copyright` | Built-in — text + auto/manual year + link |
| Social | `social` | Built-in — platform/url/label/icon list |
| Custom | `custom` | Built-in HTML/CSS (+ JS stub); free-form escape hatch |

Place particles on the canvas at **`/app/admin/layouts`**. See `src/core/modules/README.md`.
