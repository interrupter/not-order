describe('notOrder browser testing', function() {
  before(async () => {
    await cy.exec('npm run buildtest');
  });

  it('basic test', () => {
    cy.server({
      delay: 1000
    });
    cy.route('PUT', '/api/order/good', 'fixture:order.put.good.json');
    cy.route('PUT', '/api/order/failure', 'fixture:order.put.failure.json');
    cy.visit('http://localhost:7357/order.ui.html');
////open good - close
    cy.get('button#test-good').click();
    cy.get('.order-form-cancel').should('exist');
    cy.get('.not-overlay').should('exist');
    cy.get('.not-overlay .buttons-row .order-form-cancel').click();
    cy.get('.order-form-cancel').should('not.exist');
    cy.get('.not-overlay').should('not.exist');
////open bad - close
    cy.get('button#test-bad').click();
    cy.get('.order-form-cancel').should('exist');
    cy.get('.not-overlay').should('exist');
    cy.get('.not-overlay .buttons-row .order-form-cancel').click();
    cy.get('.order-form-cancel').should('not.exist');
    cy.get('.not-overlay').should('not.exist');
////open good - order - auto close
    cy.get('button#test-good').click();
    cy.get('.order-form-cancel').should('exist');
    cy.get('.not-overlay').should('exist');
    cy.get('.not-overlay .buttons-row .order-form-submit').click();
    cy.get('.not-overlay .lds-ellipsis').should('exist');
    cy.get('.not-overlay .centered')
      .should(($p) => {
        // should have found 3 elements
        expect($p).to.have.length(1)
        // make sure the first contains some text content
        expect($p.first()).to.contain('Оформление заказа успешно завершено!')
      });
    cy.wait(1100);
    cy.get('.not-overlay').should('not.exist');
////open bad - order - auto close
    cy.get('button#test-bad').click();
    cy.get('.order-form-cancel').should('exist');
    cy.get('.not-overlay').should('exist');
    cy.get('.not-overlay .buttons-row .order-form-submit').click();
    cy.get('.not-overlay .lds-ellipsis').should('exist');
    cy.get('.not-overlay .centered')
      .should(($p) => {
        // should have found 3 elements
        expect($p).to.have.length(1)
      // make sure the first contains some text content
        expect($p.first()).to.contain('Во время оформления заказа произошла ошибка!')
      });
    cy.wait(1100);
    cy.get('.not-overlay .order-form-tel label').should('exist').should('have.class', 'mdc-text-field--invalid');
    cy.get('.not-overlay .order-form-email label').should('exist').should('have.class', 'mdc-text-field--invalid');
    cy.get('.not-overlay .order-form-name label').should('exist').should('have.class', 'mdc-text-field--invalid');
    cy.get('.not-overlay .order-form-comment label').should('exist').should('have.class', 'mdc-text-field--invalid');
    cy.get('.not-overlay .buttons-row .order-form-cancel').click();
    cy.get('.order-form-cancel').should('not.exist');
    cy.get('.not-overlay').should('not.exist');
  });
});
