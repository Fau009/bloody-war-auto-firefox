// background.js — no Firefox roda como "background page" comum (não
// service worker), carregado depois de shared.js (ver manifest.json:
// background.scripts). Por isso não usa importScripts aqui — os globais de
// shared.js (STORAGE_KEY, DEFAULT_CONFIG, bwaSetConfig, ...) já estão
// disponíveis nesse mesmo escopo. A lógica de ataque roda no content.js
// (que tem acesso direto ao DOM do jogo); este arquivo só cuida do setup.

const AUTO_DISABLE_ALARM = "bwa_auto_disable";

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(STORAGE_KEY);
  if (!existing[STORAGE_KEY]) {
    await bwaSetConfig(structuredClone(DEFAULT_CONFIG));
    console.log("[BloodyWarAuto] Config padrão criada.");
  }
});

// Dispara quando o timer de "desativar automaticamente" vence — funciona
// mesmo com o popup fechado, já que alarms são gerenciados pelo browser,
// não pela página do popup.
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== AUTO_DISABLE_ALARM) return;

  const config = await bwaGetConfig();
  config.masterEnabled = false;
  config.autoDisable.disableAt = null;
  await bwaSetConfig(config);
  await bwaAppendLog({ type: "sistema", result: "inativo", target: "desativado automaticamente (timer)" });
  console.log("[BloodyWarAuto] Desativado automaticamente pelo timer.");
});
