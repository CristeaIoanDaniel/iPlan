import 'package:flutter/material.dart';

class PlanScreen extends StatefulWidget {
  const PlanScreen({super.key});

  @override
  State<PlanScreen> createState() => _PlanScreenState();
}

class _PlanScreenState extends State<PlanScreen> {
  int _selectedDays = 3; // Default 3 days
  final _destinationController = TextEditingController();
  bool _isSearching = false;

  @override
  void dispose() {
    _destinationController.dispose();
    super.dispose();
  }

  void _searchHotels() {
    if (_destinationController.text.isEmpty) return;
    setState(() => _isSearching = true);
    // Simulate API search
    Future.delayed(const Duration(seconds: 1), () {
      if (mounted) setState(() => _isSearching = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Plan Your Holiday !')),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Where do you want to go?',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _destinationController,
              decoration: const InputDecoration(
                labelText: 'Destination City or Country',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.location_on),
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'How many days is your trip?',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            // Holiday duration selector (3 to 7 days)
            DropdownButtonFormField<int>(
              value: _selectedDays,
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.calendar_today),
              ),
              items: [3, 4, 5, 6, 7].map((days) {
                return DropdownMenuItem(
                  value: days,
                  child: Text('$days Days Holiday'),
                );
              }).toList(),
              onChanged: (value) {
                if (value != null) setState(() => _selectedDays = value);
              },
            ),
            const SizedBox(height: 32),
            ElevatedButton.icon(
              onPressed: _isSearching ? null : _searchHotels,
              icon: const Icon(Icons.search),
              label: Text(_isSearching ? 'Searching Hotels...' : 'Search Hotels for $_selectedDays Days'),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
            ),
            const SizedBox(height: 24),
            Expanded(
              child: Center(
                child: Text(
                  'Search for a destination to view available hotels for your $_selectedDays-day trip.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.grey),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}