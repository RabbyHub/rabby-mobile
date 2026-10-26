describe('Perps Simple locale contract', () => {
  it('keeps the existing detail Close action available', () => {
    const messages = require('../../assets/locales/en/messages.json');

    expect(messages.page.perpsDetail.action.close).toBe('Close');
  });
});
