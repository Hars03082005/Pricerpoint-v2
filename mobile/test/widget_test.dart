import 'package:flutter_test/flutter_test.dart';

import 'package:pricerpoint_mobile/main.dart';

void main() {
  testWidgets('PricerPoint app loads', (WidgetTester tester) async {
    await tester.pumpWidget(const PricerPointApp());
    expect(find.text('PricerPoint'), findsOneWidget);
  });
}
