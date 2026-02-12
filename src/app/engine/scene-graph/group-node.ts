import { BaseNode } from './base-node';
import { Bounds, MutableBounds } from '@shared/math/bounds';

/**
 * Group node — container for child nodes.
 *
 * Bounds are the union of all children's world bounds.
 * Hit-testing: recurse children, deepest hit wins. O(c).
 */
export class GroupNode extends BaseNode {
  /** Whether the group is expanded in the pages panel. */
  expanded: boolean = true;

  constructor(name?: string) {
    super('group', name ?? 'Group');
    this.fill.visible = false;
    this.stroke.visible = false;
  }

  computeLocalBounds(): Bounds {
    if (this.children.length === 0) {
      return new Bounds(0, 0, this.width, this.height);
    }

    // Use children's local position + local bounds to avoid the circular
    // dependency: worldBounds → parent.worldMatrix → composeLocalMatrix → computeLocalBounds.
    const mb = new MutableBounds();
    for (const child of this.children) {
      const lb = child.computeLocalBounds();
      // Offset by child's local position (ignoring rotation/scale for bounding)
      mb.addPoint(child.x + lb.minX, child.y + lb.minY);
      mb.addPoint(child.x + lb.maxX, child.y + lb.maxY);
    }

    return mb.toImmutable();
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      expanded: this.expanded,
    };
  }

  clone(): GroupNode {
    const node = new GroupNode(this.name);
    this.copyBaseTo(node);
    node.expanded = this.expanded;
    for (const child of this.children) {
      node.addChild(child.clone());
    }
    return node;
  }
}
