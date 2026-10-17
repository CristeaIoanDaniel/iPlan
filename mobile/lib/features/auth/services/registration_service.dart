import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../core/network/api_client.dart';

class RegistrationService {
  final ApiClient _apiClient = ApiClient();
  final _storage = const FlutterSecureStorage();

  Future<void> register({
    required String name,
    required String email,
    required String password,
  }) async {
    final response = await _apiClient.post('/auth/register', {
      'name': name.trim(),
      'email': email.trim(),
      'password': password,
    });

    final body = Map<String, dynamic>.from(
      jsonDecode(response.body) as Map,
    );

    if (response.statusCode != 201) {
      final errors = body['errors'];
      final message = errors is List
          ? errors
          .map((error) => '${error['field']}: ${error['message']}')
          .join('\n')
          : body['message']?.toString() ??
          'Registration failed (${response.statusCode})';

      throw Exception(message);
    }

    final data = Map<String, dynamic>.from(body['data'] as Map);
    final token = data['token'] as String;
    await _storage.write(key: 'jwt_token', value: token);
  }
}