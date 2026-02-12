import { Assets, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { BaseRenderer } from './base-renderer';
import { BaseNode, NodeType } from '../../scene-graph/base-node';
import { VideoNode } from '../../scene-graph/video-node';
import { graphicsPool } from '../../pools/graphics-pool';

/**
 * VideoRenderer — displays the poster frame of a video with a play-button overlay.
 * If no poster is available, draws a dark placeholder with a play icon.
 */
export class VideoRenderer extends BaseRenderer<Container> {
  readonly nodeType: NodeType = 'video';

  private loadedPosterMap = new Map<string, string>();

  create(_node: BaseNode): Container {
    const container = new Container();

    // Placeholder / background
    const bg = graphicsPool.acquire();
    bg.label = '__videoBg__';
    container.addChild(bg);

    // Poster sprite
    const poster = new Sprite(Texture.EMPTY);
    poster.label = '__videoPoster__';
    poster.visible = false;
    container.addChild(poster);

    // Play button overlay
    const playBtn = graphicsPool.acquire();
    playBtn.label = '__playBtn__';
    container.addChild(playBtn);

    return container;
  }

  sync(node: BaseNode, container: Container): void {
    const videoNode = node as VideoNode;
    const bg = container.getChildByLabel('__videoBg__') as Graphics;
    const poster = container.getChildByLabel('__videoPoster__') as Sprite;
    const playBtn = container.getChildByLabel('__playBtn__') as Graphics;
    if (!bg || !poster || !playBtn) return;

    const w = videoNode.width;
    const h = videoNode.height;

    // Poster frame
    if (videoNode.posterSrc) {
      const prevPoster = this.loadedPosterMap.get(node.id);
      if (prevPoster !== videoNode.posterSrc) {
        this.loadedPosterMap.set(node.id, videoNode.posterSrc);

        const posterSrc = videoNode.posterSrc;
        Assets.load<Texture>(posterSrc).then((texture) => {
          if (this.loadedPosterMap.get(node.id) !== posterSrc) return;
          poster.texture = texture;
          poster.width = w;
          poster.height = h;
          poster.visible = true;
          bg.clear();
          bg.visible = false;
        });
      }

      if (poster.texture !== Texture.EMPTY) {
        poster.width = w;
        poster.height = h;
        poster.visible = true;
        bg.clear();
        bg.visible = false;
      } else {
        // Still loading poster — show dark background
        this.drawBackground(bg, w, h);
        bg.visible = true;
      }
    } else {
      // No poster — dark placeholder
      poster.visible = false;
      this.drawBackground(bg, w, h);
      bg.visible = true;
    }

    // Play button triangle in center
    this.drawPlayButton(playBtn, w, h);
  }

  destroy(container: Container): void {
    const bg = container.getChildByLabel('__videoBg__') as Graphics;
    if (bg) graphicsPool.release(bg);
    const playBtn = container.getChildByLabel('__playBtn__') as Graphics;
    if (playBtn) graphicsPool.release(playBtn);
    const poster = container.getChildByLabel('__videoPoster__') as Sprite;
    if (poster) {
      poster.texture = Texture.EMPTY;
      poster.destroy();
    }
    container.destroy();
  }

  // ── Helpers ────────────────────────────────────────────────

  private drawBackground(gfx: Graphics, w: number, h: number): void {
    gfx.clear();
    gfx.rect(0, 0, w, h);
    gfx.fill({ color: 0x27272a });
    gfx.stroke({ color: 0x3f3f46, width: 1 });
  }

  private drawPlayButton(gfx: Graphics, w: number, h: number): void {
    gfx.clear();
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h, 80) * 0.25;

    // Semi-transparent circle
    gfx.circle(cx, cy, radius);
    gfx.fill({ color: 0x000000, alpha: 0.5 });

    // Play triangle
    const triSize = radius * 0.55;
    const triCx = cx + triSize * 0.15;
    gfx.moveTo(triCx - triSize * 0.4, cy - triSize);
    gfx.lineTo(triCx + triSize * 0.8, cy);
    gfx.lineTo(triCx - triSize * 0.4, cy + triSize);
    gfx.closePath();
    gfx.fill({ color: 0xffffff, alpha: 0.9 });
  }
}
