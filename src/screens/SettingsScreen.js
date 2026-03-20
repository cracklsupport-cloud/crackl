import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch, Platform } from 'react-native';
import Colors from '../theme/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icons from '../components/Icons';

export default function SettingsScreen({ go, update }) {
  const [toggles, setToggles] = useState({
    panic: false,
    auto: true,
    sfx: true,
    haptic: true,
    daily: true,
    streak: true,
    bounty: true,
    weekly: true
  });

  const toggle = (key) => setToggles(p => ({ ...p, [key]: !p[key] }));

  const SectionTitle = ({ title }) => (
    <Text style={{ color: Colors.textSecondary, fontFamily: 'Share Tech Mono', fontSize: 11, fontWeight: '900', letterSpacing: 2, marginBottom: 16, marginTop: 32, textTransform: 'uppercase' }}>
      {title}
    </Text>
  );

  const SettingRow = ({ label, keyName, icon: IconComp }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderDefault }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconComp size={18} color={Colors.purpleLight} />
        <Text style={{ color: Colors.textPrimary, fontFamily: 'Chakra Petch', fontSize: 15, fontWeight: '600', letterSpacing: 0.5 }}>{label}</Text>
      </View>
      <Switch 
        value={toggles[keyName]} 
        onValueChange={() => toggle(keyName)} 
        trackColor={{ false: Colors.borderDefault, true: Colors.purple }}
        thumbColor="#fff"
      />
    </View>
  );

  const LinkRow = ({ label, icon: IconComp, dest, danger }) => (
    <TouchableOpacity onPress={dest} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.borderDefault }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {IconComp && <IconComp size={18} color={danger ? Colors.rose : Colors.textSecondary} />}
        <Text style={{ color: danger ? Colors.rose : Colors.textPrimary, fontFamily: 'Chakra Petch', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 }}>{label}</Text>
      </View>
      <Icons.ChevronRightIcon size={16} color={Colors.textMuted} />
    </TouchableOpacity>
  );

  const handleSignOut = async () => {
    await AsyncStorage.removeItem('crackl_user');
    await AsyncStorage.removeItem('crackl_token');
    update(null, null); // Clear state and go to auth
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: Colors.bgBase }} contentContainerStyle={{ padding: 24, paddingBottom: 60, alignItems: 'center' }} showsVerticalScrollIndicator={false}>
      <View style={{ flex: 1, width: '100%', maxWidth: 428 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <TouchableOpacity onPress={() => go('home')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icons.ChevronLeftIcon size={14} color={Colors.purple} />
          <Text style={{ color: Colors.purple, fontFamily: 'Share Tech Mono', fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>BACK TO HUB</Text>
        </TouchableOpacity>
      </View>
      
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Icons.SettingsIcon size={24} color={'#fff'} />
        <Text style={{ color: '#fff', fontFamily: 'Chakra Petch', fontSize: 24, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' }}>SYSTEM CONFIG</Text>
      </View>

      <SectionTitle title="GAMEPLAY PARAMETERS" />
      <View style={{ backgroundColor: 'rgba(15,15,26,0.5)', paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.borderDefault}}>
        <SettingRow icon={Icons.AlertTriangleIcon} label="Panic Mode Default" keyName="panic" />
        <SettingRow icon={Icons.TerminalIcon} label="Auto-advance After Result" keyName="auto" />
        <SettingRow icon={Icons.SunIcon} label="Timer Sound Effects" keyName="sfx" />
        <SettingRow icon={Icons.TargetIcon} label="Haptic Feedback" keyName="haptic" />
      </View>

      <SectionTitle title="ALERTS & COMMS" />
      <View style={{ backgroundColor: 'rgba(15,15,26,0.5)', paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.borderDefault}}>
        <SettingRow icon={Icons.SunIcon} label="Daily Drop Reminder" keyName="daily" />
        <SettingRow icon={Icons.FlameIcon} label="Streak Warning" keyName="streak" />
        <SettingRow icon={Icons.TrophyIcon} label="Bounty Board Alerts" keyName="bounty" />
        <SettingRow icon={Icons.DatabaseIcon} label="Weekly Brain Profile" keyName="weekly" />
      </View>

      <SectionTitle title="OPERATIVE ACCOUNT" />
      <View style={{ backgroundColor: 'rgba(15,15,26,0.5)', paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.borderDefault}}>
        <LinkRow icon={Icons.CopyIcon} label="Edit Alias" />
        <LinkRow icon={Icons.GlobeIcon} label="Edit Sector Logs" />
        <LinkRow icon={Icons.LinkIcon} label="Change Payout Node" />
      </View>

      <SectionTitle title="UI THEME" />
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
        {['Void Dark', 'Nightshade', 'AMOLED'].map((t, i) => (
          <TouchableOpacity key={t} style={{ flex: 1, paddingVertical: 14, backgroundColor: i === 0 ? Colors.purple : 'rgba(15,15,26,0.6)', borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: i === 0 ? Colors.purple : Colors.borderDefault }}>
            <Text style={{ color: i === 0 ? '#fff' : Colors.textSecondary, fontFamily: 'Share Tech Mono', fontSize: 11, fontWeight: '700' }}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <SectionTitle title="SYSTEM MANIFEST" />
      <View style={{ backgroundColor: 'rgba(15,15,26,0.5)', paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.borderDefault}}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderDefault }}>
          <Text style={{ color: Colors.textPrimary, fontFamily: 'Chakra Petch', fontSize: 15, fontWeight: '600' }}>Kernel Version</Text>
          <Text style={{ color: Colors.textMuted, fontFamily: 'Share Tech Mono' }}>v5.0.0 (Cinematic)</Text>
        </View>
        <LinkRow label="Encryption Policy (Privacy)" />
        <LinkRow label="Engagement Rules (TOS)" />
      </View>

      <SectionTitle title="DANGER ZONE" />
      <View style={{ backgroundColor: 'rgba(239,68,68,0.05)', paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.rose + '40'}}>
        <LinkRow icon={Icons.XIcon} label="Sever Connection (Sign Out)" dest={handleSignOut} danger={true} />
        <LinkRow icon={Icons.TrashIcon} label="Purge Profile" danger={true} />
      </View>

      </View>
    </ScrollView>
  );
}
