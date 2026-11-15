export * from '/core/node-utils.js';

export const formatDateTime = date => date.toLocaleString(navigator.languages || navigator.language);

export const formatTime = date => date.toLocaleTimeString(navigator.languages || navigator.language);
