import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions, type TextStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useLastFm } from '../../hooks/useLastFm';
import { isLive, patterns, statusLabel, tones, type ListeningState, type Pattern, type Tone } from '../../services/listening-model';
import type { UserTrack } from '../../types/lastfm';
import { AlbumCover } from '../../components/AlbumCover';
import { WidgetPreview } from '../../components/WidgetPreview';
import { catDoodle, patternIcon } from '../../components/doodles';

const c = { paper: '#FAF8F2', ink: '#37352F', muted: '#817D73', line: '#E8E4DA', green: '#61795C', rose: '#B55E72' };
const demo: ListeningState = {
  usernames: ['mochi', 'fern', 'june', 'olive', 'mika'], settings: { tone: 'blush', pattern: 'doodles', friend: null },
  tracks: [
    { username: 'mochi', currentTrack: { title: 'Glue Song', artist: 'beabadoobee', album: 'Glue Song', isNowPlaying: false } },
    { username: 'fern', currentTrack: { title: 'Show Me How', artist: 'Men I Trust', album: 'Show Me How', isNowPlaying: false } },
    { username: 'june', currentTrack: { title: 'From The Start', artist: 'Laufey', album: 'Bewitched', isNowPlaying: false } },
    { username: 'olive', currentTrack: { title: 'Juna', artist: 'Clairo', album: 'Charm', isNowPlaying: false } },
    { username: 'mika', currentTrack: { title: 'Porcelain', artist: 'Ichiko Aoba', album: 'Windswept Adan', isNowPlaying: false } },
  ],
};

export default function HomeScreen() {
  const fm = useLastFm();
  const { width } = useWindowDimensions();
  const [inputFocused, setInputFocused] = useState(false);
  const [tab, setTab] = useState<'friends' | 'widgets'>('friends');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const report = async (action: () => Promise<unknown>) => {
    setBusy(true); setMessage('');
    try { await action(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Something went wrong. Try again.'); }
    finally { setBusy(false); }
  };
  const addFriend = () => {
    const name = username.trim();
    if (!name) { setMessage('Enter a Last.fm username first.'); return; }
    if (!/^[a-zA-Z0-9_-]{1,32}$/.test(name)) { setMessage('Use the profile username, rather than a profile URL.'); return; }
    void report(async () => { await fm.addUsername(name); setUsername(''); });
  };
  const rows = fm.usernames.map(name => fm.tracks.find(row => row.username === name) ?? { username: name, currentTrack: null });
  const preview = fm.usernames.length ? fm : { ...demo, settings: fm.settings };
  const setTone = (tone: Tone) => void report(() => fm.updateSettings({ ...fm.settings, tone }));
  const setPattern = (pattern: Pattern) => void report(() => fm.updateSettings({ ...fm.settings, pattern }));
  const trackCard = (row: UserTrack) => <View key={row.username} style={s.friend}>
    <View style={s.between}>
      <View style={s.inline}><View style={[s.dot, { backgroundColor: isLive(row) ? c.green : '#C9C4B8' }]} /><Text style={s.friendName}>{row.username}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${row.username}`} hitSlop={10} onPress={() => setConfirmRemove(row.username)}><Ionicons name="close-outline" size={20} color={c.muted} /></Pressable>
    </View>
    <Pressable accessibilityRole={row.currentTrack?.url ? 'link' : undefined} disabled={!row.currentTrack?.url} onPress={() => { if (row.currentTrack?.url) void Linking.openURL(row.currentTrack.url).catch(() => setMessage('Could not open this song.')); }} style={[s.inline, { marginTop: 16, gap: 14 }]}>
      <AlbumCover track={row.currentTrack} size={56} />
      <View style={{ flex: 1, gap: 5 }}>
        <Text style={s.song} numberOfLines={2}>{row.currentTrack?.title || (row.error ? 'Could not load this profile' : fm.loading ? 'Checking their last song…' : 'Quiet for now')}</Text>
        <Text style={s.body} numberOfLines={1}>{row.currentTrack?.artist || (row.error ? row.error : 'No recent songs on Last.fm')}</Text>
        <Text style={{ fontSize: 11, color: isLive(row) ? c.green : c.muted }}>{statusLabel(row)}</Text>
      </View>
    </Pressable>
    {confirmRemove === row.username ? <View style={[s.inline, { marginTop: 16, gap: 16 }]}>
      <Text style={[s.body, { flex: 1 }]}>Remove from your circle?</Text>
      <Pressable accessibilityRole="button" onPress={() => setConfirmRemove(null)}><Text style={s.link}>Keep</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => void report(async () => { await fm.removeUsername(row.username); setConfirmRemove(null); })}><Text style={s.link}>Remove</Text></Pressable>
    </View> : null}
  </View>;

  return <SafeAreaView style={{ flex: 1, backgroundColor: c.paper }}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={fm.loading} onRefresh={fm.refreshTracks} tintColor={c.green} />}>
        <View style={s.between}>
          <Text style={s.wordmark}>little fm<Text style={{ color: c.rose }}>.</Text></Text>
        </View>
        <Text style={s.intro}>A little closer, one song at a time.</Text>
        <View style={s.tabs}>{(['friends', 'widgets'] as const).map(value => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: value === tab }} onPress={() => setTab(value)} style={[s.tab, tab === value && s.activeTab]}><Ionicons name={value === 'friends' ? 'people-outline' : 'grid-outline'} size={16} color={tab === value ? c.paper : c.muted} /><Text style={{ color: tab === value ? c.paper : c.muted, fontSize: 13, fontWeight: '600' }}>{value === 'friends' ? 'Your circle' : 'Widgets'}</Text></Pressable>)}</View>
        {(message || fm.error) ? <Text accessibilityRole="alert" style={s.error}>{message || fm.error}</Text> : null}

        <View style={s.sectionIntro}>
          <View style={[s.between, { minHeight: width < 360 ? 52 : 28, alignItems: 'flex-start' }]}>
            <Text style={[s.heading, { flex: 1 }]}>{tab === 'friends' ? 'On their turntable' : 'A little music, at a glance'}</Text>
            {tab === 'friends' ? <Pressable style={s.refresh} accessibilityRole="button" accessibilityLabel="Refresh friends" onPress={() => void fm.refreshTracks()}><Ionicons name="refresh-outline" size={20} color={c.muted} /></Pressable> : <View style={s.refresh} />}
          </View>
          <Text style={s.sectionDescription}>{tab === 'friends' ? 'What your friends are listening to, wherever they are.' : "Quiet little windows into your friends' soundtracks."}</Text>
        </View>

        {tab === 'friends' ? <>
          {!fm.ready && !fm.error ? <ActivityIndicator color={c.green} /> : null}
          {fm.ready && rows.length === 0 ? <View style={s.empty}><SvgXml accessibilityLabel="Cat drawing" xml={catDoodle} width={180} height={180} /><Text style={[s.heading, { marginTop: 20 }]}>Make room for a friend</Text><Text style={[s.body, { textAlign: 'center', marginTop: 8 }]}>Add their Last.fm username below. Their latest song will show up here, and on your home screen.</Text></View> : rows.map(trackCard)}
          <View style={[s.inputRow, inputFocused && s.inputFocused]}><TextInput onFocus={() => setInputFocused(true)} onBlur={() => setInputFocused(false)} underlineColorAndroid="transparent" accessibilityLabel="Last.fm username" placeholder="A friend's Last.fm username" placeholderTextColor="#9B968B" value={username} onChangeText={setUsername} onSubmitEditing={addFriend} autoCapitalize="none" autoCorrect={false} editable={fm.ready && !busy} style={[s.input, Platform.OS === "web" && ({ outlineStyle: "none", outlineWidth: 0 } as unknown as TextStyle)]} returnKeyType="done" /><Pressable disabled={busy || !fm.ready} accessibilityRole="button" accessibilityLabel="Add friend" onPress={addFriend} style={[s.add, (busy || !fm.ready) && { opacity: .5 }]}>{busy ? <ActivityIndicator color={c.paper} /> : <Ionicons name="add" size={23} color={c.paper} />}</Pressable></View>
          <Text style={[s.caption, { marginTop: 10 }]}>Public listening activity only. No password needed.</Text>
        </> : <>
          <View style={{ flexDirection: width >= 600 ? 'row' : 'column', gap: 22, paddingVertical: 26, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ gap: 12 }}><WidgetPreview state={preview} onRefresh={() => void fm.refreshTracks()} /><Text style={s.previewLabel}>A little listening · one friend</Text></View>
            <View style={{ gap: 12 }}><WidgetPreview state={preview} circle maxWidth={width - 48} onRefresh={() => void fm.refreshTracks()} /><Text style={s.previewLabel}>Listening circle · everyone, just scroll</Text></View>
          </View>
          {!fm.usernames.length ? <Text style={s.caption}>Example songs shown. Add friends in Your circle for your own soundtrack.</Text> : null}
          <Text style={s.fieldLabel}>Pattern</Text>
          <View style={[s.inline, { gap: 10 }]}>{(Object.keys(patterns) as Pattern[]).map(pattern => <Pressable key={pattern} disabled={busy} accessibilityRole="radio" accessibilityState={{ checked: fm.settings.pattern === pattern }} accessibilityLabel={`${patterns[pattern]} pattern`} onPress={() => setPattern(pattern)} style={[s.pattern, fm.settings.pattern === pattern && s.selectedPattern]}><SvgXml xml={patternIcon(pattern)} width={26} height={28} /><Text style={{ color: c.ink, fontSize: 13 }}>{patterns[pattern]}</Text></Pressable>)}</View>
          <Text style={s.fieldLabel}>Color</Text>
          <View style={[s.inline, { gap: 10, flexWrap: 'wrap' }]}>{(Object.keys(tones) as Tone[]).map(tone => <Pressable key={tone} disabled={busy} accessibilityRole="radio" accessibilityState={{ checked: fm.settings.tone === tone }} accessibilityLabel={`${tones[tone].name} color`} onPress={() => setTone(tone)} style={[s.tone, { backgroundColor: tones[tone].background, borderColor: fm.settings.tone === tone ? tones[tone].accent : 'transparent' }]}><Text style={{ color: tones[tone].ink, fontSize: 13 }}>{tones[tone].name}</Text></Pressable>)}</View>
          <Text style={s.fieldLabel}>Friend</Text>
          {fm.usernames.length ? <View style={[s.inline, { flexWrap: 'wrap', gap: 8 }]}>{fm.usernames.map((name, i) => <Pressable disabled={busy} key={name} accessibilityRole="radio" accessibilityState={{ checked: (fm.settings.friend || fm.usernames[0]) === name }} onPress={() => void report(() => fm.updateSettings({ ...fm.settings, friend: name }))} style={[s.chip, (fm.settings.friend || fm.usernames[0]) === name && { borderColor: '#B55E72', backgroundColor: '#F7E9E6' }]}><Text style={s.body}>{name}</Text></Pressable>)}</View> : <Text style={s.body}>Add your first friend in Your circle.</Text>}
          <View style={s.instructions}><Text style={s.instructionHeading}>How to add</Text><Text style={[s.body, { marginTop: 12, lineHeight: 24 }]}>1. Long-press an empty spot on your Android home screen.{ '\n' }2. Tap Widgets and find little fm.{ '\n' }3. Drag A little listening or Listening circle onto your screen.</Text><Text style={[s.caption, { marginTop: 14 }]}>Tap a widget to open the app, or ↻ to check for a new song.</Text></View>
        </>}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const s = StyleSheet.create({
  page: { width: '100%', maxWidth: 620, alignSelf: 'center', padding: 24, paddingTop: 30, paddingBottom: 32 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  wordmark: { fontFamily: 'Pacifico', fontSize: 30, color: c.ink },
  intro: { fontSize: 13, color: c.muted, marginTop: 10 },
  eyebrow: { fontSize: 10, color: c.muted, letterSpacing: 1 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  tabs: { flexDirection: 'row', marginTop: 28, backgroundColor: '#EEEAE0', padding: 4, borderRadius: 14 },
  tab: { flex: 1, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 10 },
  activeTab: { backgroundColor: c.rose },
  heading: { fontSize: 20, color: c.ink, fontWeight: '600', letterSpacing: -.5 },
  sectionIntro: { marginTop: 28, marginBottom: 12 },
  sectionDescription: { fontSize: 13, color: c.muted, lineHeight: 19, marginTop: 8, minHeight: 38 },
  refresh: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontSize: 12, color: c.muted, marginTop: 26, marginBottom: 12 },
  instructionHeading: { fontSize: 16, color: c.ink, fontWeight: '600' },
  body: { fontSize: 13, color: c.muted, lineHeight: 19 },
  caption: { fontSize: 11, color: c.muted, lineHeight: 17 },
  error: { color: '#A13F51', backgroundColor: '#F7E9E6', padding: 14, borderRadius: 12, fontSize: 13, marginTop: 18 },
  friend: { paddingVertical: 22, borderBottomWidth: 1, borderColor: c.line },
  friendName: { color: c.ink, fontSize: 12, fontWeight: '600' },
  song: { fontSize: 17, color: c.ink, fontWeight: '600', letterSpacing: -.3 },
  art: { width: 56, height: 56, borderRadius: 10 },
  link: { fontSize: 12, color: '#A34E63', fontWeight: '600' },
  empty: { paddingVertical: 28, alignItems: 'center', paddingHorizontal: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, backgroundColor: '#F0EDE4', borderWidth: 1.5, borderColor: '#E8E4DA', padding: 5, marginTop: 28 },
  inputFocused: { borderColor: '#98A68D', backgroundColor: '#F5F4ED' },
  input: { flex: 1, minWidth: 0, borderWidth: 0, backgroundColor: 'transparent', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 13, color: c.ink, minHeight: 46 },
  add: { width: 46, height: 46, backgroundColor: c.rose, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  widget: { borderRadius: 24, padding: 16 },
  widgetRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 12 },
  previewLabel: { color: c.muted, fontSize: 11, textAlign: 'center' },
  tone: { paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5 },
  pattern: { flex: 1, minHeight: 74, paddingVertical: 10, gap: 6, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1.5, borderColor: c.line },
  selectedPattern: { borderColor: '#B55E72', backgroundColor: '#F7EEEA' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 30, borderWidth: 1, borderColor: c.line },
  instructions: { marginTop: 28, padding: 20, borderWidth: 1, borderColor: c.line, borderRadius: 18, marginBottom: 14 },
});
