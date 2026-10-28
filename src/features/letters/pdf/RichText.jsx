import { Text } from '@react-pdf/renderer';
import { BOLD } from './pdfTheme.js';

/** Splits "We offer **White Gloves**." into plain and bold parts (only **bold** is supported). */
export function richParts(text) {
  return String(text ?? '')
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part) =>
      part.startsWith('**') && part.endsWith('**')
        ? { bold: true, text: part.slice(2, -2) }
        : { bold: false, text: part },
    );
}

/** A paragraph with **bold** parts. */
export function RichText({ text, style }) {
  return (
    <Text style={style}>
      {richParts(text).map((part, index) =>
        part.bold ? (
          <Text key={index} style={{ fontFamily: BOLD }}>
            {part.text}
          </Text>
        ) : (
          part.text
        ),
      )}
    </Text>
  );
}
