export const getThemeColors = (theme) => ({
  background: theme === 'dark' ? '#222' : '#f7f7f7',
  card: theme === 'dark' ? '#333' : '#fff',
  text: theme === 'dark' ? '#fff' : '#222',
  border: theme === 'dark' ? '#555' : '#ccc',
  button: '#3e86f5',
}); 