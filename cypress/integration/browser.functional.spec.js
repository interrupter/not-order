describe('notOrder browser testing', function() {
  before(async () => {
    await cy.exec('npm run buildtest');
  });

  it('basic test', () => {
    cy.server({
      delay: 10000
    });
    cy.route('PUT', '/api/order/good', 'fixture:order.put.good.json');
    cy.route('PUT', '/api/order/failure', 'fixture:order.put.failure.json');
    cy.visit('http://localhost:7357/order.ui.html');
    cy.get('button.order-form-submit').should('exist');
  });
});
