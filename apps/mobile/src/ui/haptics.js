import * as Haptics from 'expo-haptics';

let enabled = true;

const run = effect => {
	if (enabled) effect().catch(err => console.warn('Haptic feedback failed:', err.message));
};

export const setHapticsEnabled = value => {
	enabled = value;
};

export const haptics = {
	tap: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
	confirm: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
	select: () => run(() => Haptics.selectionAsync()),
	success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
	error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
