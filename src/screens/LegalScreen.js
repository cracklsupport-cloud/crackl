import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform } from 'react-native';
import Colors from '../theme/colors';
import Icons from '../components/Icons';
import { legalDocuments, legalQuickNotes, LEGAL_UPDATED_AT } from '../legal/legalContent';
import { useResponsive } from '../theme/breakpoints';

const isWeb = Platform.OS === 'web';
const mono = isWeb ? '"JetBrains Mono", monospace' : 'Share Tech Mono';
const display = isWeb ? '"Space Grotesk", sans-serif' : 'Chakra Petch';

export default function LegalScreen({ user, go }) {
  const { isPhone, isMobile } = useResponsive();
  const [activeId, setActiveId] = useState('terms');
  const activeDoc = useMemo(
    () => legalDocuments.find((doc) => doc.id === activeId) || legalDocuments[0],
    [activeId]
  );
  const backTarget = user ? 'settings' : 'auth';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors.bgBase }}
      contentContainerStyle={{
        paddingHorizontal: isPhone ? 14 : 24,
        paddingTop: isPhone ? 18 : 28,
        paddingBottom: 90,
        alignItems: 'center'
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ width: '100%', maxWidth: 1120 }}>
        <TouchableOpacity
          onPress={() => go(backTarget)}
          style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginBottom: 24 }, isWeb ? { cursor: 'pointer' } : {}]}
        >
          <Icons.ChevronLeftIcon size={15} color={Colors.cyan} />
          <Text style={{ color: Colors.cyan, fontFamily: mono, fontSize: 12, fontWeight: '900', letterSpacing: 1.4, textTransform: 'uppercase' }}>
            {user ? 'Back to Settings' : 'Back to Login'}
          </Text>
        </TouchableOpacity>

        <View style={[{
          borderRadius: 18,
          borderWidth: 1,
          borderColor: 'rgba(34,211,238,0.22)',
          backgroundColor: 'rgba(10,10,12,0.82)',
          padding: isPhone ? 18 : 28,
          overflow: 'hidden'
        }, isWeb ? { backdropFilter: 'blur(18px)', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' } : {}]}>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: Colors.cyan }} />
          <View style={{ flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', gap: 16 }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <Icons.ShieldIcon size={isPhone ? 18 : 22} color={Colors.cyan} />
                <Text style={{ color: Colors.textPrimary, fontFamily: display, fontSize: isPhone ? 22 : 34, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' }}>
                  Legal Command Center
                </Text>
              </View>
              <Text style={{ color: Colors.textSecondary, fontFamily: mono, fontSize: isPhone ? 11 : 13, lineHeight: isPhone ? 18 : 22, maxWidth: 760 }}>
                Rules, privacy, fair play, rewards, and safety policies for CRACKL Arena.
              </Text>
            </View>
            <View style={{ alignSelf: isMobile ? 'flex-start' : 'center', borderWidth: 1, borderColor: Colors.borderDefault, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.03)' }}>
              <Text style={{ color: Colors.textMuted, fontFamily: mono, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase' }}>Updated</Text>
              <Text style={{ color: Colors.textPrimary, fontFamily: mono, fontSize: 12, marginTop: 2 }}>{LEGAL_UPDATED_AT}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 24 }}>
            {legalDocuments.map((doc) => {
              const selected = doc.id === activeId;
              return (
                <TouchableOpacity
                  key={doc.id}
                  onPress={() => setActiveId(doc.id)}
                  style={[{
                    paddingHorizontal: isPhone ? 10 : 14,
                    paddingVertical: isPhone ? 9 : 11,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: selected ? Colors.cyan : Colors.borderDefault,
                    backgroundColor: selected ? 'rgba(34,211,238,0.12)' : 'rgba(255,255,255,0.025)'
                  }, isWeb ? { cursor: 'pointer' } : {}]}
                >
                  <Text style={{ color: selected ? Colors.cyanLight : Colors.textSecondary, fontFamily: mono, fontSize: isPhone ? 10 : 11, fontWeight: '900', letterSpacing: 1.1, textTransform: 'uppercase' }}>
                    {doc.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 18, marginTop: 18, alignItems: 'flex-start' }}>
          <View style={{ flex: 1, width: '100%' }}>
            <View style={{ borderRadius: 16, borderWidth: 1, borderColor: Colors.borderDefault, backgroundColor: 'rgba(255,255,255,0.025)', padding: isPhone ? 18 : 26 }}>
              <Text style={{ color: Colors.gold, fontFamily: mono, fontSize: 11, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
                {activeDoc.kicker}
              </Text>
              <Text style={{ color: Colors.textPrimary, fontFamily: display, fontSize: isPhone ? 22 : 30, fontWeight: '900', letterSpacing: 0.4, marginBottom: 10 }}>
                {activeDoc.title}
              </Text>
              <Text style={{ color: Colors.textSecondary, fontFamily: mono, fontSize: isPhone ? 12 : 13, lineHeight: isPhone ? 19 : 22, marginBottom: 22 }}>
                {activeDoc.summary}
              </Text>

              <View style={{ gap: 18 }}>
                {activeDoc.sections.map((section) => (
                  <View key={section.title} style={{ borderTopWidth: 1, borderTopColor: Colors.borderDefault, paddingTop: 18 }}>
                    <Text style={{ color: Colors.textPrimary, fontFamily: display, fontSize: isPhone ? 16 : 18, fontWeight: '900', letterSpacing: 0.4, marginBottom: 8 }}>
                      {section.title}
                    </Text>
                    {section.body.map((line) => (
                      <Text key={line} style={{ color: Colors.textSecondary, fontFamily: mono, fontSize: isPhone ? 11 : 12, lineHeight: isPhone ? 18 : 21, marginBottom: 8 }}>
                        {line}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View style={{ width: isMobile ? '100%' : 320, gap: 14 }}>
            <View style={{ borderRadius: 16, borderWidth: 1, borderColor: 'rgba(245,158,11,0.24)', backgroundColor: 'rgba(245,158,11,0.06)', padding: isPhone ? 16 : 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Icons.AlertTriangleIcon size={16} color={Colors.gold} />
                <Text style={{ color: Colors.goldLight, fontFamily: display, fontSize: 14, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' }}>
                  Launch Notes
                </Text>
              </View>
              {legalQuickNotes.map((note) => (
                <Text key={note} style={{ color: Colors.textSecondary, fontFamily: mono, fontSize: 11, lineHeight: 18, marginBottom: 10 }}>
                  {note}
                </Text>
              ))}
            </View>

            <View style={{ borderRadius: 16, borderWidth: 1, borderColor: Colors.borderDefault, backgroundColor: 'rgba(255,255,255,0.025)', padding: isPhone ? 16 : 20 }}>
              <Text style={{ color: Colors.textPrimary, fontFamily: display, fontSize: 15, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
                Contact
              </Text>
              <Text style={{ color: Colors.textSecondary, fontFamily: mono, fontSize: 11, lineHeight: 18 }}>
                For reports, account problems, reward disputes, or legal notices, use in-app support when available or contact the CRACKL operator through the published launch channel.
              </Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
