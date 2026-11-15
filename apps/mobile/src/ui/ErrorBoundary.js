import { Component } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { colors, spacing } from '../theme';

const styles = StyleSheet.create({
	root: { flexGrow: 1, justifyContent: 'center', gap: spacing.md, padding: spacing.xl, backgroundColor: colors.bg },
	title: { color: colors.text, fontSize: 18, fontWeight: '700' },
	message: { color: colors.redBright, fontSize: 14 },
	stack: { color: colors.textMuted, fontSize: 11, fontFamily: 'monospace' },
});

export class ErrorBoundary extends Component {
	state = { error: null };

	static getDerivedStateFromError(error) {
		return { error };
	}

	componentDidCatch(error, info) {
		console.error('Unhandled render error:', error?.message, error?.stack, info?.componentStack);
	}

	render() {
		const { error } = this.state;
		if (!error) return this.props.children;

		return (
			<ScrollView contentContainerStyle={styles.root}>
				<Text style={styles.title}>MeshCore Map</Text>
				<Text style={styles.message} selectable>{String(error?.message ?? error)}</Text>
				<Text style={styles.stack} selectable>{String(error?.stack ?? '').slice(0, 1500)}</Text>
			</ScrollView>
		);
	}
}
