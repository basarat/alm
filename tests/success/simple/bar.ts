/** An intentionally global variable */
const bar = 123;
/** An intentionally global `function` */
function barFunc() {

}

interface BarInterface {
  new (bar: string): BarInterface;
  barInterfaceMember: string;
  barInterfaceMethod(): string;
  barInterfaceMethodGeneric<T>(a: T): T;
}
interface BarInterFaceWithSignature<T> {
  [key: string]: T;
}

enum BarEnum {
  BarEnumMember
}

class BarGlobalClass {
  globalClassMember: string;
  [key: string]: string;
}