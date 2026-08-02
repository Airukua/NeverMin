import { add, MathService } from './math';

export class AppController {
  private readonly service = new MathService();

  render() {
    const total = add(1, 2);
    return this.service.format(total);
  }
}
