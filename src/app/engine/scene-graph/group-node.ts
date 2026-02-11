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

    const mb = new MutableBounds();
    for (const child of this.children) {
      mb.unionMut(child.worldBounds);
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
