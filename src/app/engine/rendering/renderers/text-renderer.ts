import { Text as PixiText, Container } from 'pixi.js';
import { BaseRenderer } from './base-renderer';
import { BaseNode, NodeType } from '../../scene-graph/base-node';
import { TextNode } from '../../scene-graph/text-node';
import { colorToNumber } from '@shared/utils/color-utils';
import { textPool } from '../../pools/object-pool';

export class TextRenderer extends BaseRenderer<Container> {
  readonly nodeType: NodeType = 'text';

  create(node: BaseNode): Container {
    const pixiText = textPool.acquire();
    this.sync(node, pixiText);
    return pixiText;
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
    textPool.release(displayObject as PixiText);
  }
}
