import React from 'react';
import { Image, Platform, Text, View } from 'react-native';
import Colors from '../theme/colors';

const isWeb = Platform.OS === 'web';
const mono = isWeb ? '"JetBrains Mono", monospace' : undefined;
const serif = 'Cormorant Garamond';
const display = 'Chakra Petch';

function inferMediaKind(riddle = {}) {
  const type = riddle.riddle_type || '';
  const url = (riddle.media_url || '').split('?')[0].toLowerCase();
  if (type.includes('audio') || /\.(mp3|wav|m4a|ogg|aac)$/.test(url)) return 'audio';
  if (type.includes('video') || /\.(mp4|webm|mov|m4v)$/.test(url)) return 'video';
  if (type.includes('interactive') || /\.(html|htm|json|js|txt)$/.test(url)) return 'interactive';
  return riddle.media_url ? 'image' : 'none';
}

function safeMediaUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (isWeb && /^blob:/i.test(raw)) return raw;
  return '';
}

function shouldRenderQuestion(riddle = {}) {
  const question = (riddle.question || '').trim();
  if (!question) return false;
  if (riddle.riddle_type === 'image_only' && question === '[Visual Riddle]') return false;
  if (riddle.riddle_type === 'interactive' && question === '[Interactive Riddle]') return false;
  return true;
}

function MediaBlock({ riddle, accent = Colors.cyan }) {
  const url = safeMediaUrl(riddle?.media_url);
  if (!url) return null;

  const kind = inferMediaKind(riddle);
  const wrap = {
    width: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: shouldRenderQuestion(riddle) ? 18 : 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: `${accent}35`,
  };

  if (kind === 'audio') {
    if (isWeb) {
      return (
        <View style={[wrap, { padding: 16 }]}>
          <Text style={{ color: accent, fontFamily: mono, fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginBottom: 10 }}>
            AUDIO CLUE
          </Text>
          <audio controls src={url} style={{ width: '100%' }} />
        </View>
      );
    }
    return (
      <View style={[wrap, { padding: 16 }]}>
        <Text style={{ color: accent, fontFamily: mono, fontSize: 12, fontWeight: '900' }}>AUDIO CLUE READY</Text>
      </View>
    );
  }

  if (kind === 'video') {
    if (isWeb) {
      return (
        <View style={wrap}>
          <video controls src={url} style={{ width: '100%', maxHeight: 360, display: 'block', backgroundColor: '#000' }} />
        </View>
      );
    }
    return (
      <View style={[wrap, { padding: 16 }]}>
        <Text style={{ color: accent, fontFamily: mono, fontSize: 12, fontWeight: '900' }}>VIDEO CLUE READY</Text>
      </View>
    );
  }

  if (kind === 'interactive') {
    if (isWeb) {
      return (
        <View style={[wrap, { height: 360 }]}>
          <iframe
            title="Interactive riddle asset"
            src={url}
            sandbox="allow-scripts allow-forms"
            style={{ width: '100%', height: '100%', border: 0, backgroundColor: '#050508' }}
          />
        </View>
      );
    }
    return (
      <View style={[wrap, { padding: 16 }]}>
        <Text style={{ color: accent, fontFamily: mono, fontSize: 12, fontWeight: '900' }}>INTERACTIVE CLUE READY</Text>
      </View>
    );
  }

  return (
    <View style={[wrap, { height: 280 }]}>
      <Image source={{ uri: url }} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
    </View>
  );
}

function LayoutElement({ el, riddle, canvasW, canvasH, accent }) {
  const style = {
    position: 'absolute',
    left: `${((Number(el.x) || 0) / canvasW * 100).toFixed(3)}%`,
    top: `${((Number(el.y) || 0) / canvasH * 100).toFixed(3)}%`,
    width: `${((Number(el.width) || canvasW) / canvasW * 100).toFixed(3)}%`,
    height: `${((Number(el.height) || 80) / canvasH * 100).toFixed(3)}%`,
    borderRadius: Number(el.borderRadius) || 0,
    overflow: 'hidden',
  };

  if (el.type === 'image') {
    const src = safeMediaUrl(el.src === 'media_url' ? riddle.media_url : (el.src || riddle.media_url));
    return src ? (
      <View style={[style, { opacity: el.opacity ?? 1 }]}>
        <Image source={{ uri: src }} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
      </View>
    ) : (
      <View style={[style, { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${accent}35` }]}>
        <Text style={{ color: Colors.textMuted, fontFamily: mono, fontSize: 11 }}>IMAGE</Text>
      </View>
    );
  }

  if (['audio', 'video', 'embed'].includes(el.type)) {
    const src = safeMediaUrl(el.src === 'media_url' ? riddle.media_url : (el.src || riddle.media_url));
    const mediaWrap = [style, {
      opacity: el.opacity ?? 1,
      backgroundColor: 'rgba(0,0,0,0.42)',
      borderWidth: 1,
      borderColor: `${accent}35`,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 8,
    }];

    if (isWeb && src && el.type === 'audio') {
      return (
        <View style={mediaWrap}>
          <Text style={{ color: accent, fontFamily: mono, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 8 }}>AUDIO CLUE</Text>
          <audio controls src={src} style={{ width: '100%' }} />
        </View>
      );
    }

    if (isWeb && src && el.type === 'video') {
      return (
        <View style={[style, { opacity: el.opacity ?? 1, backgroundColor: '#000' }]}>
          <video controls src={src} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
        </View>
      );
    }

    if (isWeb && src && el.type === 'embed') {
      return (
        <View style={[style, { opacity: el.opacity ?? 1, backgroundColor: '#050508' }]}>
          <iframe
            title="Interactive riddle asset"
            src={src}
            sandbox="allow-scripts allow-forms"
            style={{ width: '100%', height: '100%', border: 0, backgroundColor: '#050508' }}
          />
        </View>
      );
    }

    return (
      <View style={mediaWrap}>
        <Text style={{ color: accent, fontFamily: mono, fontSize: 11, fontWeight: '900', letterSpacing: 1.1 }}>
          {el.type === 'audio' ? 'AUDIO CLUE' : el.type === 'video' ? 'VIDEO CLUE' : 'INTERACTIVE CLUE'}
        </Text>
      </View>
    );
  }

  const fontFamily = el.fontFamily === 'serif' ? serif : el.fontFamily === 'mono' ? mono : display;
  return (
    <View style={[style, {
      justifyContent: 'center',
      alignItems: el.textAlign === 'left' ? 'flex-start' : el.textAlign === 'right' ? 'flex-end' : 'center',
      padding: 4,
    }]}>
      <Text style={{
        color: el.color || Colors.textPrimary,
        fontFamily,
        fontSize: Number(el.fontSize) || 20,
        fontWeight: el.fontWeight || '700',
        lineHeight: (Number(el.fontSize) || 20) * 1.35,
        textAlign: el.textAlign || 'center',
        width: '100%',
      }}>
        {el.content || riddle.question}
      </Text>
    </View>
  );
}

function LayoutBlock({ riddle, accent }) {
  const layout = riddle?.layout_config;
  const elements = Array.isArray(layout?.elements) ? layout.elements : [];
  if (!elements.length) return null;

  const canvasW = Number(layout?.canvas?.width) || 375;
  const canvasH = Number(layout?.canvas?.height) || 510;

  return (
    <View style={{
      width: '100%',
      aspectRatio: canvasW / canvasH,
      position: 'relative',
      overflow: 'hidden',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: `${accent}25`,
      backgroundColor: 'rgba(0,0,0,0.18)',
    }}>
      {elements.map((el, index) => (
        <LayoutElement
          key={el.id || `${el.type}-${index}`}
          el={el}
          riddle={riddle}
          canvasW={canvasW}
          canvasH={canvasH}
          accent={accent}
        />
      ))}
    </View>
  );
}

export default function RiddleContent({ riddle, accent = Colors.cyan, questionStyle, containerStyle }) {
  const hasLayout = riddle?.layout_config && Array.isArray(riddle.layout_config.elements) && riddle.layout_config.elements.length > 0;

  return (
    <View style={containerStyle}>
      {hasLayout ? (
        <LayoutBlock riddle={riddle} accent={accent} />
      ) : (
        <>
          <MediaBlock riddle={riddle} accent={accent} />
          {shouldRenderQuestion(riddle) ? (
            <Text style={[{
              color: Colors.textPrimary,
              fontFamily: serif,
              fontSize: 24,
              fontWeight: '700',
              lineHeight: 34,
            }, questionStyle]}>
              {riddle?.question}
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}
