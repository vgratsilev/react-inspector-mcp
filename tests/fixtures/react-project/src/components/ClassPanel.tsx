interface ClassPanelProps {
  title: string;
  compact?: boolean;
}

declare class Component<P> {
  props: P;
}

export class ClassPanel extends Component<ClassPanelProps> {
  render() {
    return (
      <section>
        <span>{this.props.title}</span>
        <span>{this.props.compact ? "Compact" : "Full"}</span>
      </section>
    );
  }
}
