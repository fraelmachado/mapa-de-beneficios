/* @ds-bundle: {"format":3,"namespace":"MapaDeBenefCios_804719","components":[{"name":"Alert","sourcePath":"components/Alert/Alert.jsx"},{"name":"Button","sourcePath":"components/Button/Button.jsx"},{"name":"Checklist","sourcePath":"components/Checklist/Checklist.jsx"},{"name":"Chip","sourcePath":"components/Chip/Chip.jsx"},{"name":"HeroRadar","sourcePath":"components/HeroRadar/HeroRadar.jsx"},{"name":"Input","sourcePath":"components/Input/Input.jsx"},{"name":"Nav","sourcePath":"components/Nav/Nav.jsx"},{"name":"Pass","sourcePath":"components/Pass/Pass.jsx"},{"name":"Row","sourcePath":"components/Row/Row.jsx"},{"name":"SegmentedControl","sourcePath":"components/SegmentedControl/SegmentedControl.jsx"},{"name":"Skeleton","sourcePath":"components/Skeleton/Skeleton.jsx"}],"sourceHashes":{"components/Alert/Alert.jsx":"88f22757a7ad","components/Button/Button.jsx":"70abba3aec22","components/Checklist/Checklist.jsx":"435988c67402","components/Chip/Chip.jsx":"e54d78922cfd","components/HeroRadar/HeroRadar.jsx":"9a8b87317aa2","components/Input/Input.jsx":"7292c78d0f1f","components/Nav/Nav.jsx":"24be9dae4dfd","components/Pass/Pass.jsx":"ba1a1d3e251c","components/Row/Row.jsx":"1eea4638ac6a","components/SegmentedControl/SegmentedControl.jsx":"ebd951123845","components/Skeleton/Skeleton.jsx":"8851886c0f29","design_handoff_discover/design-system/ds-preview.js":"06f4fee379d6","ds-preview.js":"06f4fee379d6"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.MapaDeBenefCios_804719 = window.MapaDeBenefCios_804719 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/Alert/Alert.jsx
try { (() => {
/**
 * Alerta de atenção/compliance. Usa as classes de styles.css.
 */
function Alert({
  children,
  icon = '⚠'
}) {
  return React.createElement('div', {
    className: 'alert',
    role: 'note'
  }, React.createElement('span', {
    'aria-hidden': 'true'
  }, icon), React.createElement('div', null, children));
}
Object.assign(__ds_scope, { Alert });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/Alert/Alert.jsx", error: String((e && e.message) || e) }); }

// components/Button/Button.jsx
try { (() => {
/**
 * Botão do Mapa de Benefícios. Usa as classes de styles.css.
 */
function Button({
  children,
  variant = 'primary',
  disabled = false,
  type = 'button',
  onClick,
  icon
}) {
  const cls = 'btn' + (variant === 'ink' ? ' ink' : variant === 'ghost' ? ' ghost' : '');
  return React.createElement('button', {
    className: cls,
    type,
    disabled,
    onClick
  }, icon || null, children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/Button/Button.jsx", error: String((e && e.message) || e) }); }

// components/Checklist/Checklist.jsx
try { (() => {
/**
 * Checklist de elegibilidade. Usa as classes de styles.css.
 * items: [{ label, done }] — não concluídos são numerados na ordem.
 */
function Checklist({
  items = []
}) {
  let step = 0;
  return React.createElement('div', null, items.map((it, i) => {
    const last = i === items.length - 1;
    const mark = it.done ? '✓' : String(++step);
    return React.createElement('div', {
      key: i,
      className: 'check',
      style: last ? {
        borderBottom: 0
      } : undefined
    }, React.createElement('span', {
      className: 'bx' + (it.done ? ' dn' : ''),
      'aria-hidden': 'true'
    }, mark), it.label);
  }));
}
Object.assign(__ds_scope, { Checklist });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/Checklist/Checklist.jsx", error: String((e && e.message) || e) }); }

// components/Chip/Chip.jsx
try { (() => {
/**
 * Chip de filtro por categoria. Usa as classes de styles.css.
 */
function Chip({
  children,
  category,
  active = false,
  onClick
}) {
  const cls = 'chip' + (active ? ' on' : '');
  const dot = category ? React.createElement('i', {
    className: `cat-${category}`
  }) : null;
  return React.createElement('button', {
    className: cls,
    type: 'button',
    'aria-pressed': active,
    onClick
  }, dot, dot ? ' ' : null, children);
}
Object.assign(__ds_scope, { Chip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/Chip/Chip.jsx", error: String((e && e.message) || e) }); }

// components/HeroRadar/HeroRadar.jsx
try { (() => {
/**
 * Hero do Painel — resumo do radar com gradiente. Usa tokens de styles.css.
 */
function HeroRadar({
  count = 0,
  value,
  label = 'Seu radar',
  caption
}) {
  return React.createElement('div', {
    style: {
      borderRadius: '18px',
      padding: 'var(--s5)',
      color: '#fff',
      background: 'linear-gradient(120deg,var(--c-airport),var(--c-viagem) 58%,var(--c-seguro))',
      position: 'relative',
      overflow: 'hidden'
    }
  }, React.createElement('div', {
    style: {
      position: 'absolute',
      right: '-30px',
      top: '-30px',
      width: '150px',
      height: '150px',
      borderRadius: '50%',
      background: 'rgba(255,255,255,.13)'
    }
  }), React.createElement('p', {
    className: 'lbl',
    style: {
      color: 'rgba(255,255,255,.85)',
      marginBottom: '5px'
    }
  }, label), React.createElement('div', {
    style: {
      fontSize: 'var(--fz-display)',
      fontWeight: 800,
      letterSpacing: '-.04em',
      lineHeight: 1
    }
  }, count), caption ? React.createElement('div', {
    style: {
      fontSize: '13px',
      opacity: .92,
      marginTop: '4px'
    }
  }, caption) : value != null ? React.createElement('div', {
    style: {
      fontSize: '13px',
      opacity: .92,
      marginTop: '4px'
    }
  }, 'benefícios ativos · ', React.createElement('b', null, value), ' em valor estimado/ano') : null);
}
Object.assign(__ds_scope, { HeroRadar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/HeroRadar/HeroRadar.jsx", error: String((e && e.message) || e) }); }

// components/Input/Input.jsx
try { (() => {
/**
 * Campo de entrada com ícone. Usa as classes de styles.css.
 */
function Input({
  type = 'text',
  placeholder,
  value,
  onChange,
  icon,
  ariaLabel
}) {
  return React.createElement('label', {
    className: 'input'
  }, icon ? React.createElement('span', {
    className: 'muted',
    'aria-hidden': 'true'
  }, icon) : null, React.createElement('input', {
    type,
    placeholder,
    value,
    onChange,
    'aria-label': ariaLabel || placeholder
  }));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/Input/Input.jsx", error: String((e && e.message) || e) }); }

// components/Nav/Nav.jsx
try { (() => {
/**
 * Navegação (bottom nav no mobile / lista lateral no desktop).
 * items: [{ label, icon, href, active }]
 */
function Nav({
  items = [],
  ariaLabel = 'Principal'
}) {
  return React.createElement('nav', {
    className: 'nav',
    'aria-label': ariaLabel
  }, items.map((it, i) => React.createElement('a', {
    key: it.href || i,
    href: it.href || '#',
    'aria-current': it.active ? 'page' : undefined
  }, it.icon ? React.createElement('span', {
    className: 'ic',
    'aria-hidden': 'true'
  }, it.icon) : null, it.label)));
}
Object.assign(__ds_scope, { Nav });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/Nav/Nav.jsx", error: String((e && e.message) || e) }); }

// components/Pass/Pass.jsx
try { (() => {
const CAT = {
  airport: '--c-airport',
  seguro: '--c-seguro',
  viagem: '--c-viagem',
  cashback: '--c-cashback',
  compras: '--c-compras',
  pontos: '--c-pontos'
};
const ORIGIN = {
  emissor: {
    cls: 'iss',
    sym: '●'
  },
  bandeira: {
    cls: 'brand',
    sym: '◈'
  },
  parceiro: {
    cls: 'part',
    sym: '●'
  }
};

/**
 * Passe — card de benefício do Mapa de Benefícios.
 * Usa as classes de styles.css (carregue a folha junto do bundle).
 */
function Pass({
  title,
  via,
  desc,
  category = 'airport',
  tag,
  isNew = false,
  originType = 'emissor',
  originLabel,
  href,
  onClick
}) {
  const catVar = CAT[category] || CAT.airport;
  const origin = ORIGIN[originType] || ORIGIN.emissor;
  const interactive = !!href || !!onClick;
  const Tag = href ? 'a' : 'div';
  const topRight = isNew ? React.createElement('span', {
    className: 'new'
  }, 'novo') : tag ? React.createElement('span', {
    className: 'tag'
  }, tag) : null;
  return React.createElement(Tag, {
    className: 'pass',
    href: href || undefined,
    onClick,
    tabIndex: interactive && !href ? 0 : undefined,
    role: interactive && !href ? 'button' : undefined,
    style: {
      '--cat': `var(${catVar})`
    }
  }, React.createElement('div', {
    className: 'edge'
  }), React.createElement('div', {
    className: 'stub'
  }, React.createElement('div', {
    className: 'top'
  }, React.createElement('span', {
    className: 'via'
  }, 'via ', React.createElement('b', null, via)), topRight), React.createElement('h3', null, title), desc ? React.createElement('p', {
    className: 'd'
  }, desc) : null), React.createElement('div', {
    className: 'perf'
  }), React.createElement('div', {
    className: 'foot'
  }, React.createElement('span', {
    className: `pill ${origin.cls}`
  }, `${origin.sym} ${originLabel || ''}`), React.createElement('span', {
    className: 'go',
    'aria-hidden': 'true'
  }, '→')));
}
Object.assign(__ds_scope, { Pass });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/Pass/Pass.jsx", error: String((e && e.message) || e) }); }

// components/Row/Row.jsx
try { (() => {
/**
 * Linha de lista. Vira link quando há href. Usa as classes de styles.css.
 */
function Row({
  children,
  leading,
  trailing,
  href,
  onClick
}) {
  const Tag = href ? 'a' : 'div';
  const main = leading ? React.createElement('span', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--s3)'
    }
  }, leading, children) : children;
  return React.createElement(Tag, {
    className: 'row',
    href: href || undefined,
    onClick,
    tabIndex: !href && onClick ? 0 : undefined,
    role: !href && onClick ? 'button' : undefined
  }, main, trailing != null ? React.createElement('span', {
    className: 'muted',
    'aria-hidden': 'true'
  }, trailing) : null);
}
Object.assign(__ds_scope, { Row });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/Row/Row.jsx", error: String((e && e.message) || e) }); }

// components/SegmentedControl/SegmentedControl.jsx
try { (() => {
/**
 * Controle segmentado (ordenação/abas). Usa as classes de styles.css.
 * options: [{ label, value }]
 */
function SegmentedControl({
  options = [],
  value,
  onChange,
  ariaLabel
}) {
  return React.createElement('div', {
    className: 'seg',
    role: 'tablist',
    'aria-label': ariaLabel
  }, options.map(opt => React.createElement('button', {
    key: opt.value,
    className: opt.value === value ? 'on' : '',
    type: 'button',
    role: 'tab',
    'aria-selected': opt.value === value,
    onClick: onChange ? () => onChange(opt.value) : undefined
  }, opt.label)));
}
Object.assign(__ds_scope, { SegmentedControl });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/SegmentedControl/SegmentedControl.jsx", error: String((e && e.message) || e) }); }

// components/Skeleton/Skeleton.jsx
try { (() => {
/**
 * Placeholder de carregamento. `variant="pass"` imita um card Passe;
 * `variant="bar"` é uma barra simples (use width/height).
 */
function Skeleton({
  variant = 'bar',
  width,
  height,
  radius
}) {
  if (variant === 'pass') {
    const bar = (w, h, extra) => React.createElement('div', {
      className: 'sk',
      style: {
        height: h,
        width: w,
        ...extra
      }
    });
    return React.createElement('div', {
      className: 'pass',
      style: {
        '--cat': 'var(--line)'
      }
    }, React.createElement('div', {
      className: 'edge'
    }), React.createElement('div', {
      className: 'stub'
    }, bar('130px', '12px', {
      marginBottom: '10px'
    }), bar('90%', '18px', {
      marginBottom: '7px'
    }), bar('70%', '13px')), React.createElement('div', {
      className: 'perf'
    }), React.createElement('div', {
      className: 'foot'
    }, bar('120px', '22px', {
      borderRadius: '99px'
    }), bar('31px', '31px', {
      borderRadius: '10px'
    })));
  }
  return React.createElement('div', {
    className: 'sk',
    style: {
      width: width || '100%',
      height: height || '14px',
      borderRadius: radius
    }
  });
}
Object.assign(__ds_scope, { Skeleton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/Skeleton/Skeleton.jsx", error: String((e && e.message) || e) }); }

// design_handoff_discover/design-system/ds-preview.js
try { (() => {
/* Seletor de tema para os cards do Design System.
   Aplica o tema salvo (ou o do sistema) e injeta um botão flutuante.
   A escolha é compartilhada entre todos os cards via localStorage (mb-theme). */
(function () {
  var KEY = 'mb-theme';
  function sysDark() {
    try {
      return matchMedia('(prefers-color-scheme: dark)').matches;
    } catch (e) {
      return false;
    }
  }
  function get() {
    try {
      return localStorage.getItem(KEY);
    } catch (e) {
      return null;
    }
  }
  function save(t) {
    try {
      localStorage.setItem(KEY, t);
    } catch (e) {}
  }
  function apply(t) {
    document.documentElement.setAttribute('data-theme', t);
  }
  apply(get() || (sysDark() ? 'dark' : 'light'));
  function build() {
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', 'Alternar tema claro/escuro');
    b.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:9999;width:44px;height:44px;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:var(--ink);box-shadow:var(--shadow);cursor:pointer;display:grid;place-items:center;font-size:18px;font-family:var(--font)';
    function render() {
      b.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '☀' : '☾';
    }
    render();
    b.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      apply(next);
      save(next);
      render();
    });
    document.body.appendChild(b);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);else build();
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "design_handoff_discover/design-system/ds-preview.js", error: String((e && e.message) || e) }); }

// ds-preview.js
try { (() => {
/* Seletor de tema para os cards do Design System.
   Aplica o tema salvo (ou o do sistema) e injeta um botão flutuante.
   A escolha é compartilhada entre todos os cards via localStorage (mb-theme). */
(function () {
  var KEY = 'mb-theme';
  function sysDark() {
    try {
      return matchMedia('(prefers-color-scheme: dark)').matches;
    } catch (e) {
      return false;
    }
  }
  function get() {
    try {
      return localStorage.getItem(KEY);
    } catch (e) {
      return null;
    }
  }
  function save(t) {
    try {
      localStorage.setItem(KEY, t);
    } catch (e) {}
  }
  function apply(t) {
    document.documentElement.setAttribute('data-theme', t);
  }
  apply(get() || (sysDark() ? 'dark' : 'light'));
  function build() {
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', 'Alternar tema claro/escuro');
    b.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:9999;width:44px;height:44px;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:var(--ink);box-shadow:var(--shadow);cursor:pointer;display:grid;place-items:center;font-size:18px;font-family:var(--font)';
    function render() {
      b.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '☀' : '☾';
    }
    render();
    b.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      apply(next);
      save(next);
      render();
    });
    document.body.appendChild(b);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);else build();
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ds-preview.js", error: String((e && e.message) || e) }); }

__ds_ns.Alert = __ds_scope.Alert;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Checklist = __ds_scope.Checklist;

__ds_ns.Chip = __ds_scope.Chip;

__ds_ns.HeroRadar = __ds_scope.HeroRadar;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Nav = __ds_scope.Nav;

__ds_ns.Pass = __ds_scope.Pass;

__ds_ns.Row = __ds_scope.Row;

__ds_ns.SegmentedControl = __ds_scope.SegmentedControl;

__ds_ns.Skeleton = __ds_scope.Skeleton;

})();
