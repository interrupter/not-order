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
    cy.get('.is-overlay').should('exist');
    cy.get('.is-overlay .buttons .order-form-cancel').click();
    cy.get('.order-form-cancel').should('not.exist');
    cy.get('.is-overlay').should('not.exist');
////open bad - close
    cy.get('button#test-bad').click();
    cy.get('.order-form-cancel').should('exist');
    cy.get('.is-overlay').should('exist');
    cy.get('.is-overlay .buttons .order-form-cancel').click();
    cy.get('.order-form-cancel').should('not.exist');
    cy.get('.is-overlay').should('not.exist');
////open good - order - auto close
    cy.get('button#test-good').click();
    cy.get('.order-form-cancel').should('exist');
    cy.get('.is-overlay').should('exist');
    cy.get('.is-overlay .buttons .order-form-submit').click();
    cy.get('.is-overlay .notification')
      .should(($p) => {
        // should have found 3 elements
        expect($p).to.have.length(1)
        // make sure the first contains some text content
        expect($p.first()).to.contain('Оформление заказа успешно завершено!')
      });
    cy.wait(200);
    cy.get('.is-overlay').should('not.exist');
////open bad - order - auto close
    cy.get('button#test-bad').click();
    cy.get('.order-form-cancel').should('exist');
    cy.get('.is-overlay').should('exist');
    cy.get('.is-overlay .buttons .order-form-submit').click();
    cy.get('.is-overlay .edit-form-error.notification.is-danger').should('exist');
    cy.wait(200);
    cy.get('.is-overlay .form-field-UITelephone-tel p.help').should('exist').should('have.class', 'is-danger');
    cy.get('.is-overlay .form-field-UIEmail-email p.help').should('exist').should('have.class', 'is-danger');
    cy.get('.is-overlay .form-field-UITextfield-name p.help').should('exist').should('have.class', 'is-danger');
    cy.get('.is-overlay .form-field-UITextarea-comment p.help').should('exist').should('have.class', 'is-danger');
    cy.get('.is-overlay .buttons .order-form-cancel').click();
    cy.get('.order-form-cancel').should('not.exist');
    cy.get('.is-overlay').should('not.exist');
  });
});
