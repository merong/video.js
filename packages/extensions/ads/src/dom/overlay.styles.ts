/** Package-local presentation; media remains full frame at every control layout. @internal */
export const overlayStyles = `
  :host {
    position:absolute; inset:0; z-index:100; display:block; container-type:inline-size;
    color:var(--ads-color,var(--media-foreground,#fff));
    font:var(--ads-font-size,13px)/1.4 var(--ads-font-family,var(--media-font-family,system-ui));
  }
  *,*::before,*::after{box-sizing:border-box}
  [hidden]{display:none!important}
  .panel{position:absolute;inset:0;overflow:hidden;background:var(--ads-background,#000);border-radius:var(--ads-radius,var(--media-video-border-radius,var(--media-border-radius,0)))}
  .creative,video,img{position:absolute;inset:0;width:100%;height:100%}
  video,img{object-fit:contain}
  .header{position:absolute;inset:0 0 auto;padding:var(--ads-inset,12px);pointer-events:none;background:linear-gradient(#0008,transparent)}
  .status{display:inline-block;max-width:100%;margin:0;padding:4px 8px;border-radius:4px;background:#0009;overflow-wrap:anywhere}
  .footer{position:absolute;inset:auto 0 0;display:grid;gap:8px;padding:24px var(--ads-inset,12px) max(var(--ads-inset,12px),env(safe-area-inset-bottom));background:var(--ads-scrim,linear-gradient(transparent,#000b))}
  .actions,.controls{display:flex;align-items:center;gap:8px;min-width:0}
  .actions{justify-content:space-between}
  button,a{font:inherit;color:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
  button{display:grid;place-items:center;flex-shrink:0;min-width:var(--ads-control-size,var(--media-control-size,36px));min-height:var(--ads-control-size,var(--media-control-size,36px));padding:6px;border:0;border-radius:var(--ads-control-radius,var(--media-control-radius,8px));background:var(--ads-button-background,#0005)}
  button:hover,a:hover{background:var(--ads-hover-background,#ffffff26)}
  button:disabled{cursor:default;opacity:.65}
  svg{display:block;width:20px;height:20px;pointer-events:none}
  .skip{padding-inline:12px;max-width:58%;margin-inline-start:auto;border:1px solid #ffffff80;border-radius:var(--ads-skip-radius,6px);overflow-wrap:anywhere}
  .link{display:block;min-width:0;max-width:58%;padding:6px 10px;border-radius:6px;background:#0008;text-underline-offset:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .timer{min-width:0;margin-inline-start:auto;font-variant-numeric:tabular-nums;white-space:nowrap}
  .volume{width:64px;min-width:36px;flex-shrink:1;accent-color:var(--ads-accent-color,var(--media-accent-color,#fff));margin:0;cursor:pointer}
  button:focus-visible,a:focus-visible,input:focus-visible{outline:2px solid var(--ads-focus-color,var(--media-ring,var(--media-accent-color,#fff)));outline-offset:2px}
  @container (max-width:400px){.header{padding:8px}.footer{padding:20px 8px max(8px,env(safe-area-inset-bottom));gap:6px}.controls,.actions{gap:6px}.volume{width:48px}.skip{padding-inline:8px}}
  @container (max-width:280px){.panel{font-size:11px}.controls{gap:4px}.volume{width:36px}button{min-width:30px;min-height:30px;padding:5px}svg{width:18px;height:18px}.link{padding-inline:6px}}
  @media (forced-colors:active){button,a,.status{background:Canvas;color:CanvasText;border:1px solid ButtonText}button:disabled{color:GrayText}.footer,.header{background:none}}
`;
