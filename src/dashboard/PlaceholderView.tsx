import { Card } from '../components/Card';

export function PlaceholderView({ title, text }: { title: string; text: string }) {
  return (
    <Card title={title}>
      <p className="muted">{text}</p>
    </Card>
  );
}
