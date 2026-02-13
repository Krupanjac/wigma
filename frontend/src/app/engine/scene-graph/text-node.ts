import { BaseNode } from './base-node';
import { Bounds } from '@shared/math/bounds';
import { DEFAULT_FONT_SIZE, DEFAULT_FONT_FAMILY } from '@shared/constants';

/**
 * Text alignment options.
 */
export type TextAlign = 'left' | 'center' | 'right';
export type TextVerticalAlign = 'top' | 'middle' | 'bottom';
export type FontWeight = 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
export type FontStyle = 'normal' | 'italic';

/**
 * Text node with rich text properties.
 * Hit-testing uses AABB. O(1).
 */
export class TextNode extends BaseNode {
  text: string = 'Text';
  fontSize: number = DEFAULT_FONT_SIZE;
  fontFamily: string = DEFAULT_FONT_FAMILY;
  fontWeight: FontWeight = 'normal';
  fontStyle: FontStyle = 'normal';
  textAlign: TextAlign = 'left';
  verticalAlign: TextVerticalAlign = 'top';
  lineHeight: number = 1.2;
  letterSpacing: number = 0;
  autoSize: boolean = true;

  constructor(name?: string) {
    super('text', name ?? 'Text');
    this.width = 200;
    this.height = 24;
    this.stroke.visible = false;
  }

  computeLocalBounds(): Bounds {
    return new Bounds(0, 0, this.width, this.height);
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      text: this.text,
      fontSize: this.fontSize,
      fontFamily: this.fontFamily,
      fontWeight: this.fontWeight,
      fontStyle: this.fontStyle,
      textAlign: this.textAlign,
      verticalAlign: this.verticalAlign,
      lineHeight: this.lineHeight,
      letterSpacing: this.letterSpacing,
    };
  }

  clone(): TextNode {
    const node = new TextNode(this.name);
    this.copyBaseTo(node);
    node.text = this.text;
    node.fontSize = this.fontSize;
    node.fontFamily = this.fontFamily;
    node.fontWeight = this.fontWeight;
    node.fontStyle = this.fontStyle;
    node.textAlign = this.textAlign;
    node.verticalAlign = this.verticalAlign;
    node.lineHeight = this.lineHeight;
    node.letterSpacing = this.letterSpacing;
    node.autoSize = this.autoSize;
    return node;
  }
}
