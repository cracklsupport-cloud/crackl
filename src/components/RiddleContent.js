import React from 'react';
import { Image, Platform, Text, View } from 'react-native';
import Colors from '../theme/colors';

const isWeb = Platform.OS === 'web';
const mono = isWeb ? '"JetBrains Mono", monospace' : undefined;
const serif = 'Cormorant Garamond';
const display = isWeb ? '"Space Grotesk", sans-serif' : 'Chakra Petch';
const LAYOUT_EDGE_PAD = 14;

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

function mediaSrcForElement(el, riddle = {}) {
  return safeMediaUrl(el?.src === 'media_url' ? riddle.media_url : (el?.src || riddle.media_url));
}

function getElementMediaKind(el, src = '') {
  return inferMediaKind({
    riddle_type: el?.type || '',
    media_url: src || el?.src || ''
  });
}

function isLayoutMediaElement(el) {
  return ['image', 'audio', 'video', 'embed'].includes(el?.type);
}

function isLayoutQuestionElement(el) {
  return el?.id === 'question-text' || el?.role === 'question' || el?.bind === 'question';
}

function elementRect(el) {
  const x = Number(el?.x) || 0;
  const y = Number(el?.y) || 0;
  const width = Math.max(1, Number(el?.width) || 1);
  const height = Math.max(1, Number(el?.height) || 1);
  return { x, y, width, height, area: width * height };
}

function overlapRatio(a, b) {
  const left = Math.max(a.x, b.x);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const top = Math.max(a.y, b.y);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  const overlap = Math.max(0, right - left) * Math.max(0, bottom - top);
  return overlap / Math.max(1, Math.min(a.area, b.area));
}

function collapseRedundantLayoutElements(elements, riddle = {}) {
  const output = [];

  for (const el of elements) {
    if (!isLayoutMediaElement(el)) {
      output.push(el);
      continue;
    }

    const src = mediaSrcForElement(el, riddle);
    const rect = elementRect(el);
    const duplicateIndex = output.findIndex((existing) => {
      if (!isLayoutMediaElement(existing)) return false;
      const existingSrc = mediaSrcForElement(existing, riddle);
      if (!src || src !== existingSrc) return false;
      return overlapRatio(rect, elementRect(existing)) >= 0.78;
    });

    if (duplicateIndex === -1) {
      output.push(el);
      continue;
    }

    if (rect.area > elementRect(output[duplicateIndex]).area) {
      output[duplicateIndex] = el;
    }
  }

  return output;
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
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: shouldRenderQuestion(riddle) ? 22 : 0,
    backgroundColor: 'rgba(0,0,0,0.42)',
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
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
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
    <View style={[wrap, {
      aspectRatio: 16 / 9,
      maxHeight: isWeb ? 'min(380px, 44vh)' : 300,
      minHeight: isWeb ? undefined : 160,
    }]}>
      <Image source={{ uri: url }} resizeMode="contain" style={{ width: '100%', height: '100%' }} />
    </View>
  );
}

function LayoutElement({ el, riddle, canvasW, canvasH, yOffset = 0, accent }) {
  const top = Math.max(0, (Number(el.y) || 0) - yOffset);
  const style = {
    position: 'absolute',
    left: `${((Number(el.x) || 0) / canvasW * 100).toFixed(3)}%`,
    top: `${(top / canvasH * 100).toFixed(3)}%`,
    width: `${((Number(el.width) || canvasW) / canvasW * 100).toFixed(3)}%`,
    height: `${((Number(el.height) || 80) / canvasH * 100).toFixed(3)}%`,
    borderRadius: Number(el.borderRadius) || 0,
    overflow: 'hidden',
  };

  if (el.type === 'image') {
    const src = mediaSrcForElement(el, riddle);
    return src ? (
      <View style={[style, { opacity: el.opacity ?? 1 }]}>
        <Image source={{ uri: src }} resizeMode="contain" style={{ width: '100%', height: '100%' }} />
      </View>
    ) : (
      <View style={[style, { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${accent}35` }]}>
        <Text style={{ color: Colors.textMuted, fontFamily: mono, fontSize: 11 }}>IMAGE</Text>
      </View>
    );
  }

  if (['audio', 'video', 'embed'].includes(el.type)) {
    const src = mediaSrcForElement(el, riddle);
    const sourceKind = getElementMediaKind(el, src);
    const mediaWrap = [style, {
      opacity: el.opacity ?? 1,
      backgroundColor: 'rgba(0,0,0,0.42)',
      borderWidth: 1,
      borderColor: `${accent}35`,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 8,
    }];

    if (src && sourceKind === 'image') {
      return (
        <View style={[style, { opacity: el.opacity ?? 1, backgroundColor: 'rgba(0,0,0,0.35)' }]}>
          <Image source={{ uri: src }} resizeMode="contain" style={{ width: '100%', height: '100%' }} />
        </View>
      );
    }

    if (isWeb && src && el.type === 'audio') {
      return (
        <View style={mediaWrap}>
          <Text style={{ color: accent, fontFamily: mono, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 8 }}>AUDIO CLUE</Text>
          <audio controls src={src} style={{ width: '100%' }} />
        </View>
      );
    }

    if (isWeb && src && sourceKind === 'video') {
      return (
        <View style={[style, { opacity: el.opacity ?? 1, backgroundColor: '#000' }]}>
          <video controls src={src} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
        </View>
      );
    }

    if (isWeb && src && sourceKind === 'interactive') {
      return (
        <View style={[style, { opacity: el.opacity ?? 1, backgroundColor: '#050508' }]}>
          <iframe
            title="Interactive riddle asset"
            src={src}
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
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

  const questionText = isLayoutQuestionElement(el);
  const fontFamily = questionText ? display : (el.fontFamily === 'serif' ? display : el.fontFamily === 'mono' ? mono : display);
  const fontSize = questionText ? Math.max(28, Number(el.fontSize) || 28) : (Number(el.fontSize) || 28);
  return (
    <View style={[style, {
      justifyContent: 'center',
      alignItems: el.textAlign === 'left' ? 'flex-start' : el.textAlign === 'right' ? 'flex-end' : 'center',
      padding: 6,
    }]}>
      <Text style={{
        color: el.color || Colors.textPrimary,
        fontFamily,
        fontSize,
        fontWeight: el.fontWeight || '800',
        lineHeight: fontSize * 1.25,
        textAlign: el.textAlign || 'center',
        width: '100%',
        letterSpacing: 0.2,
      }}>
        {el.content || riddle.question}
      </Text>
    </View>
  );
}

function getLayoutContentBounds(elements, canvasH) {
  const boxes = elements
    .map((el) => {
      const y = Math.max(0, Number(el.y) || 0);
      const height = Math.max(1, Number(el.height) || 80);
      return { top: y, bottom: Math.min(canvasH, y + height) };
    })
    .filter((box) => Number.isFinite(box.top) && Number.isFinite(box.bottom));

  if (!boxes.length) {
    return { yOffset: 0, displayHeight: canvasH };
  }

  const top = Math.min(...boxes.map((box) => box.top));
  const bottom = Math.max(...boxes.map((box) => box.bottom));
  const yOffset = Math.max(0, top - LAYOUT_EDGE_PAD);
  const contentHeight = Math.max(120, bottom - yOffset + LAYOUT_EDGE_PAD);

  return {
    yOffset,
    displayHeight: Math.min(canvasH, contentHeight)
  };
}

function LayoutBlock({ riddle, accent }) {
  const layout = riddle?.layout_config;
  const elements = collapseRedundantLayoutElements(
    Array.isArray(layout?.elements) ? layout.elements : [],
    riddle
  );
  if (!elements.length) return null;

  const canvasW = Number(layout?.canvas?.width) || 375;
  const sourceCanvasH = Number(layout?.canvas?.height) || 510;
  const { yOffset, displayHeight } = getLayoutContentBounds(elements, sourceCanvasH);
  const canvasH = Math.max(120, displayHeight);

  return (
    <View style={{
      width: '100%',
      aspectRatio: canvasW / canvasH,
      maxHeight: isWeb ? 'min(420px, 52vh)' : undefined,
      position: 'relative',
      overflow: 'hidden',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: `${accent}32`,
      backgroundColor: 'rgba(0,0,0,0.24)',
    }}>
      {elements.map((el, index) => (
        <LayoutElement
          key={el.id || `${el.type}-${index}`}
          el={el}
          riddle={riddle}
          canvasW={canvasW}
          canvasH={canvasH}
          yOffset={yOffset}
          accent={accent}
        />
      ))}
    </View>
  );
}

export default function RiddleContent({ riddle, accent = Colors.cyan, questionStyle, containerStyle }) {
  const hasLayout = riddle?.layout_config && Array.isArray(riddle.layout_config.elements) && riddle.layout_config.elements.length > 0;
  const layoutHasQuestion = hasLayout && riddle.layout_config.elements.some(isLayoutQuestionElement);

  return (
    <View style={[{ width: '100%' }, containerStyle]}>
      {hasLayout ? (
        <>
          <LayoutBlock riddle={riddle} accent={accent} />
          {!layoutHasQuestion && shouldRenderQuestion(riddle) ? (
            <Text style={[{
              color: Colors.textPrimary,
              fontFamily: display,
              fontSize: 34,
              fontWeight: '800',
              lineHeight: 43,
              letterSpacing: 0.1,
              textAlign: 'center',
              marginTop: 22,
            }, questionStyle]}>
              {riddle?.question}
            </Text>
          ) : null}
        </>
      ) : (
        <>
          <MediaBlock riddle={riddle} accent={accent} />
          {shouldRenderQuestion(riddle) ? (
            <Text style={[{
              color: Colors.textPrimary,
              fontFamily: display,
              fontSize: 34,
              fontWeight: '800',
              lineHeight: 43,
              letterSpacing: 0.1,
              textAlign: 'center',
            }, questionStyle]}>
              {riddle?.question}
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}
