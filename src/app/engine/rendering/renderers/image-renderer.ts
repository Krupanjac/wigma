import { Assets, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { BaseRenderer } from './base-renderer';
import { BaseNode, NodeType } from '../../scene-graph/base-node';
import { ImageNode } from '../../scene-graph/image-node';
import { graphicsPool } from '../../pools/graphics-pool';

/**
 * ImageRenderer — displays actual image textures with a placeholder
 * fallback when no src is set. Uses a Container with a Sprite child
 * for the image and a Graphics child for the placeholder/border.
 */
export class ImageRenderer extends BaseRenderer<Container> {
  readonly nodeType: NodeType = 'image';

  /** Track per-node src so we know when texture needs updating. */
  private loadedSrcMap = new Map<string, string>();

  create(_node: BaseNode): Container {
    const container = new Container();

    // Placeholder graphics (shown when no image loaded)
    const placeholder = graphicsPool.acquire();
    placeholder.label = '__placeholder__';
    container.addChild(placeholder);

    // Image sprite (texture set on sync)
    const sprite = new Sprite(Texture.EMPTY);
    sprite.label = '__imageSprite__';
    sprite.visible = false;
    container.addChild(sprite);

    return container;
  }

  sync(node: BaseNode, container: Container): void {
    const imageNode = node as ImageNode;
    const placeholder = container.getChildByLabel('__placeholder__') as Graphics;
    const sprite = container.getChildByLabel('__imageSprite__') as Sprite;
    if (!placeholder || !sprite) return;

    if (imageNode.src) {
      // Check if texture needs to be (re)loaded
      const prevSrc = this.loadedSrcMap.get(node.id);
      if (prevSrc !== imageNode.src) {
        this.loadedSrcMap.set(node.id, imageNode.src);

        // Use Assets.load for proper async texture creation in PixiJS 8
        const src = imageNode.src;
        Assets.load<Texture>(src).then((texture) => {
          if (this.loadedSrcMap.get(node.id) !== src) return; // stale
          sprite.texture = texture;
          sprite.width = imageNode.width;
          sprite.height = imageNode.height;
          sprite.visible = true;
          placeholder.clear();
          placeholder.visible = false;
        });
      }

      // Size sprite if texture already loaded
      if (sprite.texture !== Texture.EMPTY) {
        sprite.width = imageNode.width;
        sprite.height = imageNode.height;
        sprite.visible = true;
        placeholder.clear();
        placeholder.visible = false;
      } else {
        // Still loading — show placeholder
        this.drawPlaceholder(placeholder, node.width, node.height);
        placeholder.visible = true;
      }
    } else {
      // No src — show placeholder
      sprite.visible = false;
      this.drawPlaceholder(placeholder, node.width, node.height);
      placeholder.visible = true;
    }
  }

  destroy(container: Container): void {
    const placeholder = container.getChildByLabel('__placeholder__') as Graphics;
    if (placeholder) graphicsPool.release(placeholder);
    const sprite = container.getChildByLabel('__imageSprite__') as Sprite;
    if (sprite) {
      sprite.texture = Texture.EMPTY;
      sprite.destroy();
    }
    container.destroy();
  }

  private drawPlaceholder(gfx: Graphics, w: number, h: number): void {
    gfx.clear();
    gfx.rect(0, 0, w, h);
    gfx.fill({ color: 0x3f3f46 });
    gfx.stroke({ color: 0x52525b, width: 1 });

    // Draw cross lines to indicate empty image
    const cx = w / 2;
    const cy = h / 2;
    const iconSize = Math.min(w, h, 40) * 0.4;
    gfx.moveTo(cx - iconSize, cy - iconSize);
    gfx.lineTo(cx + iconSize, cy + iconSize);
    gfx.moveTo(cx + iconSize, cy - iconSize);
    gfx.lineTo(cx - iconSize, cy + iconSize);
    gfx.stroke({ color: 0x71717a, width: 2 });
  }
}
