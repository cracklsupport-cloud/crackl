import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform } from 'react-native';
import Colors from '../theme/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icons from '../components/Icons';

const isWeb = Platform.OS === 'web';

export default function SettingsScreen({ user, go }) {
  const handleSignOut = async () => {
    await AsyncStorage.removeItem('crackl_user');
    await AsyncStorage.removeItem('crackl_token');
    go('auth');
  };

  const SectionTitle = ({ title }) => (
    <Text style={{
      color: Colors.textSecondary,
      fontFamily: 'Share Tech Mono',
      fontSize: 13,
      fontWeight: '900',
      letterSpacing: 2,
      marginBottom: 12,
      marginTop: 32,
      textTransform: 'uppercase',
    }}>
      {title}
    </Text>
  );

  const LinkRow = ({ label, desc, icon: IconComp, dest, danger, last }) => (
    <TouchableOpacity
      disabled={!dest}
      activeOpacity={0.7}
      onPress={dest}
      style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: 18,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: Colors.borderDefault,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
        {IconComp && <IconComp size={20} color={danger ? Colors.rose : Colors.textSecondary} />}
        <View style={{ flex: 1 }}>
          <Text style={{
            color: danger ? Colors.rose : Colors.textPrimary,
            fontFamily: 'Chakra Petch',
            fontSize: 16,
            fontWeight: '800',
            letterSpacing: 0.4,
          }}>{label}</Text>
          {desc && (
            <Text style={{
              color: Colors.textMuted,
              fontFamily: 'Share Tech Mono',
              fontSize: 11,
              marginTop: 3,
              lineHeight: 16,
            }}>{desc}</Text>
          )}
        </View>
      </View>
      {!!dest && <Icons.ChevronRightIcon size={16} color={Colors.textMuted} />}
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors.bgBase }}
      contentContainerStyle={{ padding: 24, paddingBottom: 80, alignItems: 'center' }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ flex: 1, width: '100%', maxWidth: 480 }}>

        {/* Header */}
        <TouchableOpacity
          onPress={() => go('home')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 28 }}
        >
          <Icons.ChevronLeftIcon size={14} color={Colors.purple} />
          <Text style={{ color: Colors.purple, fontFamily: 'Share Tech Mono', fontSize: 13, fontWeight: '800', letterSpacing: 1 }}>
            BACK TO HUB
          </Text>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <Icons.SettingsIcon size={26} color="#fff" />
          <Text style={{ color: '#fff', fontFamily: 'Chakra Petch', fontSize: 26, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' }}>
            System Config
          </Text>
        </View>
        <Text style={{ color: Colors.textMuted, fontFamily: 'Share Tech Mono', fontSize: 12, lineHeight: 18, marginBottom: 4 }}>
          Manage your operative profile, account access, and system identity.
        </Text>

        {/* Account */}
        <SectionTitle title="Account" />
        <View style={{ backgroundColor: 'rgba(15,15,26,0.5)', paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: Colors.borderDefault }}>
          <LinkRow
            icon={Icons.EditIcon}
            label="Edit Alias"
            desc="Update your operative username and avatar"
            dest={() => go('profile')}
          />
          {user?.is_admin && (
            <LinkRow
              icon={Icons.TerminalIcon}
              label="God Mode (Admin)"
              desc="Access the admin control panel"
              dest={() => go('admin')}
              last
            />
          )}
        </View>

        {/* System */}
        <SectionTitle title="System" />
        <View style={{ backgroundColor: 'rgba(15,15,26,0.5)', paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: Colors.borderDefault }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: Colors.borderDefault }}>
            <View>
              <Text style={{ color: Colors.textPrimary, fontFamily: 'Chakra Petch', fontSize: 16, fontWeight: '700' }}>Kernel Version</Text>
              <Text style={{ color: Colors.textMuted, fontFamily: 'Share Tech Mono', fontSize: 11, marginTop: 3 }}>Installed build</Text>
            </View>
            <Text style={{ color: Colors.textMuted, fontFamily: 'Share Tech Mono', fontSize: 14, alignSelf: 'center' }}>v5.0.0</Text>
          </View>
          <View style={{ paddingVertical: 18 }}>
            <Text style={{ color: Colors.textPrimary, fontFamily: 'Chakra Petch', fontSize: 16, fontWeight: '700' }}>User ID</Text>
            <Text style={{ color: Colors.textMuted, fontFamily: 'Share Tech Mono', fontSize: 11, marginTop: 3 }}>
              {user?.id ? String(user.id).slice(0, 8).toUpperCase() + '...' : '—'}
            </Text>
          </View>
        </View>

        {/* Danger Zone */}
        <SectionTitle title="Danger Zone" />
        <View style={{ backgroundColor: 'rgba(239,68,68,0.05)', paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: Colors.rose + '40' }}>
          <LinkRow
            icon={Icons.XIcon}
            label="Sever Connection"
            desc="Sign out of your operative account"
            dest={handleSignOut}
            danger
            last
          />
        </View>

      </View>
    </ScrollView>
  );
}
