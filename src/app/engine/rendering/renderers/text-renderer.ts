import { Text as PixiText, Container } from 'pixi.js';
import { BaseRenderer } from './base-renderer';
import { BaseNode, NodeType } from '../../scene-graph/base-node';
import { TextNode } from '../../scene-graph/text-node';
import { colorToNumber } from '@shared/utils/color-utils';

export class TextRenderer extends BaseRenderer<Container> {
  readonly nodeType: NodeType = 'text';

  create(node: BaseNode): Container {
    const textNode = node as TextNode;
    return new PixiText({
      text: textNode.text,
      style: {
        fontFamily: textNode.fontFamily,
        fontSize: textNode.fontSize,
        fill: colorToNumber(textNode.fill.color),
        fontWeight: textNode.fontWeight,
        fontStyle: textNode.fontStyle,
        wordWrap: true,
        wordWrapWidth: textNode.width,
      },
    });
  }

  sync(node: BaseNode, displayObject: Container): void {
    const textNode = node as TextNode;
    const pixiText = displayObject as PixiText;
    pixiText.text = textNode.text;
    pixiText.style = {
      fontFamily: textNode.fontFamily,
      fontSize: textNode.fontSize,
      fill: colorToNumber(textNode.fill.color),
      fontWeight: textNode.fontWeight,
      fontStyle: textNode.fontStyle,
      wordWrap: true,
      wordWrapWidth: textNode.width,
    };
  }

  destroy(displayObject: Container): void {
    displayObject.destroy();
  }
}
